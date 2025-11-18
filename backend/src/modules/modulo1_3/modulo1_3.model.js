// modules/modulo1_3/modulo1_3.model.js
import { pool } from "../../db/index.js";

/**
 * Aprobar una solicitud:
 * - pasa a estado 'aprobada'
 * - marca el equipo como reservado y baja cantidad_disponible en 1
 */
export async function aprobarSolicitudDB(solicitudId, aprobadorId) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Lee solicitud pendiente y bloquea fila
    const sRes = await client.query(
      `
      SELECT id, recurso_id, laboratorio_id
      FROM solicitudes
      WHERE id = $1 AND estado = 'pendiente'
      FOR UPDATE
      `,
      [solicitudId]
    );
    if (sRes.rowCount === 0) {
      const e = new Error("Solicitud no encontrada o ya procesada.");
      e.code = "REQ_NOT_FOUND";
      throw e;
    }
    const { recurso_id, laboratorio_id } = sRes.rows[0];

    // Bloquea equipo
    const eRes = await client.query(
      `
      SELECT id,
             cantidad_total,
             COALESCE(cantidad_disponible, cantidad_total) AS cd_actual
      FROM equipos_fijos
      WHERE id = $1
      FOR UPDATE
      `,
      [recurso_id]
    );
    if (eRes.rowCount === 0) {
      const e = new Error("Equipo no existe");
      e.code = "RES_NOT_FOUND";
      throw e;
    }
    const { cantidad_total, cd_actual } = eRes.rows[0];
    if (cd_actual <= 0) {
      const e = new Error("Sin stock para reservar");
      e.code = "NO_STOCK";
      throw e;
    }

    const new_cd = Math.max(0, cd_actual - 1);
    const new_estado = new_cd <= 0 ? "reservado" : "disponible";

    // Aprueba solicitud
    await client.query(
      `
      UPDATE solicitudes
      SET estado = 'aprobada',
          aprobada_en = now()
      WHERE id = $1
      `,
      [solicitudId]
    );

    // Descuenta stock y ajusta estado (sin problemas con NULL)
    await client.query(
      `
      UPDATE equipos_fijos
      SET cantidad_disponible = $2,
          estado_disp          = $3,
          updated_at           = now()
      WHERE id = $1
      `,
      [recurso_id, new_cd, new_estado]
    );

    // Bitácora
    await client.query(
      `
      INSERT INTO historial_laboratorio (laboratorio_id, usuario_id, accion, detalle)
      VALUES ($1, $2, 'reserva_aprobada', $3::jsonb)
      `,
      [laboratorio_id, aprobadorId ?? null, JSON.stringify({ solicitud_id: solicitudId, recurso_id, new_cd, new_estado })]
    );

    await client.query("COMMIT");
    return { ok: true, recurso_id, cantidad_disponible: new_cd, estado_disp: new_estado };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
/**
 * Lista “préstamos” en función de solicitudes aprobadas + estado del equipo.
 * estado: 'activos' | 'devueltos' | 'todos'
 * q: filtro de texto por usuario / recurso / laboratorio.
 */
export async function listPrestamosDB({ estado = "activos" }) {
  const client = await pool.connect();
  try {
    let filtroEquipo = "1=1";
    if (estado === "activos") {
      filtroEquipo = "e.estado_disp = 'reservado'";
    } else if (estado === "devueltos") {
      filtroEquipo = "e.estado_disp = 'disponible' AND s.fecha_devolucion IS NOT NULL";
    }

    const q = await client.query(
      `
      SELECT
        s.id               AS solicitud_id,
        s.creada_en        AS fecha_solicitud,
        s.fecha_uso_inicio,
        s.fecha_uso_fin,
        s.aprobada_en,
        s.fecha_devolucion,

        u.id               AS usuario_id,
        u.nombre           AS usuario_nombre,
        u.codigo           AS usuario_codigo,

        e.id               AS recurso_id,
        e.nombre           AS recurso_nombre,
        e.estado_disp,

        l.id               AS laboratorio_id,
        l.nombre           AS laboratorio_nombre
      FROM solicitudes s
      JOIN users         u ON u.id = s.usuario_id
      JOIN equipos_fijos e ON e.id = s.recurso_id
      JOIN laboratorios  l ON l.id = s.laboratorio_id
      WHERE s.estado = 'aprobada'
        AND ${filtroEquipo}
      ORDER BY s.aprobada_en DESC NULLS LAST, s.creada_en DESC
      LIMIT 200
      `
    );

    return q.rows;
  } finally {
    client.release();
  }
}


/**
 * Devolución: marcar equipo disponible + fecha_devolucion en la solicitud
 */
export async function registrarDevolucionDB({ solicitudId }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const sRes = await client.query(
      `
      SELECT id, recurso_id
      FROM solicitudes
      WHERE id = $1
        AND estado = 'aprobada'
      FOR UPDATE
      `,
      [solicitudId]
    );

    if (sRes.rowCount === 0) {
      const e = new Error("Solicitud no encontrada o no aprobada.");
      e.code = "REQ_NOT_FOUND";
      throw e;
    }

    const { recurso_id } = sRes.rows[0];

    // 1) Equipo vuelve a disponible
    await client.query(
      `
      UPDATE equipos_fijos
      SET estado_disp = 'disponible',
          cantidad_disponible = LEAST(cantidad_total, cantidad_disponible + 1),
          updated_at = now()
      WHERE id = $1
      `,
      [recurso_id]
    );

    // 2) Guardar fecha_devolucion en la solicitud
    const updSol = await client.query(
      `
      UPDATE solicitudes
      SET fecha_devolucion = now()
      WHERE id = $1
      RETURNING *
      `,
      [solicitudId]
    );

    await client.query("COMMIT");
    return updSol.rows[0];
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
