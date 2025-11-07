// backend/src/modules/modulo3_3/modulo3_3.model.js
import { pool } from "../../db/index.js";

async function assertLab(labId) {
  const r = await pool.query(`SELECT 1 FROM laboratorios WHERE id=$1`, [labId]);
  if (!r.rowCount) { const e = new Error("Lab no existe"); e.code = "23503"; throw e; }
}
async function getRecurso(recursoId) {
  const r = await pool.query(
    `SELECT id, laboratorio_id, reservable, estado_disp FROM equipos_fijos WHERE id=$1`,
    [recursoId]
  );
  return r.rows[0] || null;
}
function ensureRangeOrder(ini, fin) {
  if (!ini || !fin || new Date(ini) >= new Date(fin)) {
    const e = new Error("fecha_uso_inicio debe ser < fecha_uso_fin"); e.code = "22P02"; throw e;
  }
}
async function assertRecursoOk({ laboratorio_id, recurso_id }) {
  const rec = await getRecurso(recurso_id);
  if (!rec) { const e = new Error("Recurso no existe"); e.code = "23503"; throw e; }
  if (String(rec.laboratorio_id) !== String(laboratorio_id)) {
    const e = new Error("Recurso no pertenece al laboratorio"); e.code = "RESOURCE_MISMATCH"; throw e;
  }
  if (!rec.reservable) { const e = new Error("Recurso no reservable"); e.code = "NOT_RESERVABLE"; throw e; }
  return rec;
}
async function assertNoOverlapAprobadas({ recurso_id, ini, fin, excludeId=null }) {
  const params = [recurso_id, ini, fin];
  let sql = `
    SELECT 1
      FROM solicitudes
     WHERE recurso_id = $1
       AND estado = 'aprobada'
       AND tstzrange(fecha_uso_inicio, fecha_uso_fin, '[)') &&
           tstzrange($2, $3, '[)')
  `;
  if (excludeId) { sql += ` AND id <> $4`; params.push(excludeId); }
  const r = await pool.query(sql, params);
  if (r.rowCount) { const e = new Error("Traslape con reserva aprobada"); e.code = "OVERLAP_RES"; throw e; }
}
async function logHist(laboratorio_id, accion, detalle, usuario_id=null) {
  try {
    await pool.query(
      `INSERT INTO historial_laboratorio (laboratorio_id, usuario_id, accion, detalle)
       VALUES ($1,$2,$3,$4)`,
      [laboratorio_id, usuario_id, accion, JSON.stringify(detalle)]
    );
  } catch {}
}

/** Crea solicitud 'pendiente' */
export async function createRequest({
  usuario_id, laboratorio_id, recurso_id, fecha_uso_inicio, fecha_uso_fin, motivo, adjuntos,
}) {
  await assertLab(laboratorio_id);
  ensureRangeOrder(fecha_uso_inicio, fecha_uso_fin);
  await assertRecursoOk({ laboratorio_id, recurso_id });
  await assertNoOverlapAprobadas({ recurso_id, ini: fecha_uso_inicio, fin: fecha_uso_fin });

  // NUEVO: misma persona no puede duplicar/solapar para el mismo recurso
  await assertNoDupForUser({
    usuario_id,
    recurso_id,
    ini: fecha_uso_inicio,
    fin: fecha_uso_fin
  });

  // normaliza adjuntos si vienen como string
  if (typeof adjuntos === "string") { try { adjuntos = JSON.parse(adjuntos); } catch { adjuntos = null; } }

  const { rows } = await pool.query(
    `INSERT INTO solicitudes
      (usuario_id, laboratorio_id, recurso_id, fecha_uso_inicio, fecha_uso_fin, motivo, adjuntos, estado)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'pendiente')
     RETURNING id, estado, creada_en`,
    [usuario_id, laboratorio_id, recurso_id, fecha_uso_inicio, fecha_uso_fin, motivo ?? null, adjuntos ?? null]
  );

  await logHist(laboratorio_id, 'reserva_creada', { solicitud_id: rows[0].id, recurso_id, fecha_uso_inicio, fecha_uso_fin }, usuario_id);
  return rows[0];
}

/** Lista mis solicitudes (opcional ?estado=) */
export async function listMyRequests({ usuario_id, estado }) {
  const params = [usuario_id];
  const where = ["s.usuario_id = $1"];
  if (estado) { params.push(estado); where.push(`s.estado = $${params.length}`); }
  const { rows } = await pool.query(
    `SELECT s.id, s.estado, s.creada_en, s.fecha_uso_inicio, s.fecha_uso_fin, s.motivo, s.adjuntos,
            l.id AS lab_id, l.nombre AS lab_nombre,
            r.id AS recurso_id, r.nombre AS recurso_nombre, r.codigo_inventario
       FROM solicitudes s
       JOIN laboratorios  l ON l.id = s.laboratorio_id
       JOIN equipos_fijos r ON r.id = s.recurso_id
      WHERE ${where.join(" AND ")}
      ORDER BY s.creada_en DESC`,
    params
  );
  return rows;
}

/** Ver detalle (dueño o técnico/admin) */
export async function getRequestById({ id, usuario_id, rol }) {
  const params = [id];
  const where = ["s.id = $1"];
  if (rol !== "tecnico" && rol !== "admin") { params.push(usuario_id); where.push(`s.usuario_id = $${params.length}`); }
  const { rows } = await pool.query(
    `SELECT s.id, s.estado, s.creada_en, s.aprobada_en, s.fecha_devolucion,
            s.fecha_uso_inicio, s.fecha_uso_fin, s.motivo, s.adjuntos, s.usuario_id,
            l.id AS lab_id, l.nombre AS lab_nombre, l.ubicacion AS lab_ubicacion,
            r.id AS recurso_id, r.nombre AS recurso_nombre, r.codigo_inventario
       FROM solicitudes s
       JOIN laboratorios  l ON l.id = s.laboratorio_id
       JOIN equipos_fijos r ON r.id = s.recurso_id
      WHERE ${where.join(" AND ")}`,
    params
  );
  return rows[0];
}

/** Edita si es del usuario, está 'pendiente' y aún no inicia */
export async function updateRequestOwned({ id, usuario_id, patch }) {
  // Lee actual
  const cur = (await pool.query(
    `SELECT id, usuario_id, laboratorio_id, recurso_id, estado, fecha_uso_inicio, fecha_uso_fin
       FROM solicitudes WHERE id=$1`, [id]
  )).rows[0];
  if (!cur) return null;
  if (String(cur.usuario_id) !== String(usuario_id)) return null;
  if (cur.estado !== 'pendiente') return null;
  if (new Date(cur.fecha_uso_inicio) <= new Date()) return null;

  // Calcula "next" primero
  const next = {
    laboratorio_id:       patch.laboratorio_id       ?? cur.laboratorio_id,
    recurso_id:           patch.recurso_id           ?? cur.recurso_id,
    fecha_uso_inicio:     patch.fecha_uso_inicio     ?? cur.fecha_uso_inicio,
    fecha_uso_fin:        patch.fecha_uso_fin        ?? cur.fecha_uso_fin,
    motivo:               patch.motivo ?? null,
    adjuntos:             patch.adjuntos ?? null,
  };

  // Valida duplicidad / traslapes contra "next"
  await assertNoDupForUser({
    usuario_id,
    recurso_id: next.recurso_id,
    ini:        next.fecha_uso_inicio,
    fin:        next.fecha_uso_fin,
    excludeId:  id,
  });

  await assertLab(next.laboratorio_id);
  ensureRangeOrder(next.fecha_uso_inicio, next.fecha_uso_fin);
  await assertRecursoOk({ laboratorio_id: next.laboratorio_id, recurso_id: next.recurso_id });
  await assertNoOverlapAprobadas({ recurso_id: next.recurso_id, ini: next.fecha_uso_inicio, fin: next.fecha_uso_fin, excludeId: id });

  if (typeof next.adjuntos === "string") { try { next.adjuntos = JSON.parse(next.adjuntos); } catch { next.adjuntos = null; } }

  const { rows } = await pool.query(
    `UPDATE solicitudes
        SET laboratorio_id=$2, recurso_id=$3, fecha_uso_inicio=$4, fecha_uso_fin=$5,
            motivo=$6, adjuntos=$7
      WHERE id=$1
      RETURNING id, estado, fecha_uso_inicio, fecha_uso_fin, motivo, adjuntos`,
    [id, next.laboratorio_id, next.recurso_id, next.fecha_uso_inicio, next.fecha_uso_fin, next.motivo, next.adjuntos]
  );

  await logHist(next.laboratorio_id, 'otro', { solicitud_id: id, evento: 'solicitud_actualizada', patch }, usuario_id);
  return rows[0];
}


/** Cancela (delete físico) si es del usuario, pendiente, futuro */
export async function deletePendingOwned({ id, usuario_id }) {
  // obtener lab para bitácora antes de borrar
  const cur = (await pool.query(`SELECT laboratorio_id FROM solicitudes WHERE id=$1 AND usuario_id=$2`, [id, usuario_id])).rows[0];
  const { rows } = await pool.query(
    `DELETE FROM solicitudes
      WHERE id=$1 AND usuario_id=$2 AND estado='pendiente' AND fecha_uso_inicio > now()
      RETURNING id, 'eliminada'::text AS estado`,
    [id, usuario_id]
  );
  if (rows[0]) { await logHist(cur?.laboratorio_id, 'otro', { solicitud_id: id, evento: 'solicitud_cancelada' }, usuario_id); }
  return rows[0];
}

/** Cambia estado (técnico/admin) con re-chequeo de traslape al aprobar */
export async function setStatus({ id, estado, aprobada_en, actor_user_id }) {
  const allowed = new Set(["aprobada","rechazada","en_revision"]);
  if (!allowed.has(estado)) { const e = new Error("Estado inválido"); e.status = 400; throw e; }

  const cur = (await pool.query(
    `SELECT laboratorio_id, recurso_id, fecha_uso_inicio, fecha_uso_fin FROM solicitudes WHERE id=$1`, [id]
  )).rows[0];
  if (!cur) return null;

  if (estado === "aprobada") {
    await assertNoOverlapAprobadas({
      recurso_id: cur.recurso_id, ini: cur.fecha_uso_inicio, fin: cur.fecha_uso_fin, excludeId: id
    });
  }

  const setCols = [`estado=$2`];
  const params = [id, estado];
  if (estado === "aprobada") { setCols.push(`aprobada_en=COALESCE($3, now())`); params.push(aprobada_en ?? null); }
  else { setCols.push(`aprobada_en=NULL`); }

  const { rows } = await pool.query(
    `UPDATE solicitudes SET ${setCols.join(", ")} WHERE id=$1 RETURNING id, estado, aprobada_en`,
    params
  );

  const accion = estado === 'aprobada' ? 'reserva_aprobada' : (estado === 'rechazada' ? 'reserva_rechazada' : 'actualizacion_lab');
  await logHist(cur.laboratorio_id, accion, { solicitud_id: id, estado, actor_user_id }, actor_user_id);

  return rows[0];
}

async function assertNoDupForUser({ usuario_id, recurso_id, ini, fin, excludeId=null }) {
  const params = [usuario_id, recurso_id, ini, fin];
  let sql = `
    SELECT 1
      FROM solicitudes
     WHERE usuario_id = $1
       AND recurso_id  = $2
       AND estado IN ('pendiente','en_revision','aprobada')
       AND tstzrange(fecha_uso_inicio, fecha_uso_fin, '[)') &&
           tstzrange($3, $4, '[)')
  `;
  if (excludeId) { sql += ` AND id <> $5`; params.push(excludeId); }

  const r = await pool.query(sql, params);
  if (r.rowCount) {
    const e = new Error("Duplicada por usuario");
    e.code = "DUP_BY_USER";
    throw e;
  }
}

// model
export async function listRequestsAll({ estado, lab_id, q, limit = 50, offset = 0 }) {
  const where = [];
  const params = [];
  let i = 1;

  if (estado) { where.push(`s.estado = $${i++}`); params.push(estado); }
  if (lab_id) { where.push(`s.laboratorio_id = $${i++}`); params.push(lab_id); }
  if (q && String(q).trim()) {
    where.push(`(LOWER(l.nombre) ILIKE $${i} OR LOWER(r.nombre) ILIKE $${i} OR r.codigo_inventario ILIKE $${i})`);
    params.push(`%${String(q).toLowerCase()}%`); i++;
  }

  const lim = Math.max(1, Number(limit)  || 50);
  const off = Math.max(0, Number(offset) || 0);
  params.push(lim, off);

  const sql = `
    SELECT s.id, s.estado, s.creada_en, s.aprobada_en, s.fecha_uso_inicio, s.fecha_uso_fin,
           s.usuario_id, u.nombre AS usuario_nombre, u.correo AS usuario_correo,
           l.id AS lab_id, l.nombre AS lab_nombre,
           r.id AS recurso_id, r.nombre AS recurso_nombre, r.codigo_inventario
      FROM solicitudes s
      JOIN laboratorios  l ON l.id = s.laboratorio_id
      JOIN equipos_fijos r ON r.id = s.recurso_id
      JOIN users         u ON u.id = s.usuario_id
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY s.creada_en DESC
     LIMIT $${i++} OFFSET $${i}
  `;
  const { rows } = await pool.query(sql, params);
  return rows;
}


