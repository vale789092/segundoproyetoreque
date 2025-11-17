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

    // 1) Traer solicitud pendiente
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

    // 2) Marcar solicitud como aprobada
    await client.query(
      `
      UPDATE solicitudes
      SET estado = 'aprobada',
          aprobada_en = now()
      WHERE id = $1
      `,
      [solicitudId]
    );

    // 3) Marcar el equipo como RESERVADO y bajar en 1 la disponibilidad
    await client.query(
      `
      UPDATE equipos_fijos
      SET estado_disp = 'reservado',
          cantidad_disponible = GREATEST(0, cantidad_disponible - 1),
          updated_at = now()
      WHERE id = $1
      `,
      [recurso_id]
    );

    // (opcional) registrar en historial_laboratorio
    await client.query(
      `
      INSERT INTO historial_laboratorio (laboratorio_id, usuario_id, accion, detalle)
      VALUES ($1, $2, 'reserva_creada', $3::jsonb)
      `,
      [
        laboratorio_id,
        aprobadorId,
        JSON.stringify({ solicitud_id: solicitudId, recurso_id })
      ]
    );

    await client.query("COMMIT");
    return true;
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
