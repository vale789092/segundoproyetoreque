import { pool } from "../../db/index.js";

/** -------- Bitácora: HISTORIAL DE LABORATORIOS --------
 * Filtros (opcionales): laboratorio_id, accion (string|array|csv), desde, hasta, q
 * Paginación: limit (<=200), offset
 */
export async function listLabHistory({
  laboratorio_id,
  accion,
  desde,
  hasta,
  q,
  limit = 50,
  offset = 0,
} = {}) {
  limit = Number(limit);
  offset = Number(offset);
  if (!Number.isInteger(limit) || limit <= 0 || limit > 200) limit = 50;
  if (!Number.isInteger(offset) || offset < 0) offset = 0;

  const where = ["1=1"];
  const params = [];
  let i = 1;

  if (laboratorio_id) {
    where.push(`h.laboratorio_id = $${i++}`);
    params.push(laboratorio_id);
  }

  if (accion) {
    if (Array.isArray(accion)) {
      where.push(`h.accion = ANY($${i++})`);
      params.push(accion);
    } else if (typeof accion === "string" && accion.includes(",")) {
      const arr = accion.split(",").map(s => s.trim()).filter(Boolean);
      where.push(`h.accion = ANY($${i++})`);
      params.push(arr);
    } else {
      where.push(`h.accion = $${i++}`);
      params.push(String(accion));
    }
  }

  if (desde) { where.push(`h.creado_en >= $${i++}`); params.push(desde); }
  if (hasta) { where.push(`h.creado_en <  $${i++}`); params.push(hasta); }
  if (q)     { where.push(`h.detalle::text ILIKE $${i++}`); params.push(`%${q}%`); }

  const sql = `
  SELECT
    h.id,
    h.laboratorio_id,
    l.nombre AS laboratorio_nombre,          -- ← NUEVO
    h.usuario_id,
    u.nombre AS usuario_nombre,
    u.correo AS usuario_correo,
    h.accion,
    h.detalle,
    h.creado_en
  FROM historial_laboratorio h
  LEFT JOIN users u        ON u.id = h.usuario_id
  LEFT JOIN laboratorios l ON l.id = h.laboratorio_id   -- ← NUEVO
  WHERE ${where.join(" AND ")}
  ORDER BY h.creado_en DESC, h.id DESC
  LIMIT $${i} OFFSET $${i + 1}
`;
  params.push(limit, offset);

  const { rows } = await pool.query(sql, params);
  return rows;
}

/** -------- Bitácora: HISTORIAL DE MANTENIMIENTOS --------
 * Filtros (opcionales): laboratorio_id, equipo_id, mantenimiento_id, accion, desde, hasta, q
 * Paginación: limit (<=200), offset
 */
export async function listMaintenanceHistory({
  laboratorio_id,
  equipo_id,
  mantenimiento_id,
  accion,
  desde,
  hasta,
  q,
  limit = 50,
  offset = 0,
} = {}) {
  limit = Number(limit);
  offset = Number(offset);
  if (!Number.isInteger(limit) || limit <= 0 || limit > 200) limit = 50;
  if (!Number.isInteger(offset) || offset < 0) offset = 0;

  const where = ["1=1"];
  const params = [];
  let i = 1;

  if (laboratorio_id) {
    where.push(`h.laboratorio_id = $${i++}`);
    params.push(laboratorio_id);
  }
  if (equipo_id) {
    where.push(`h.equipo_id = $${i++}`);
    params.push(equipo_id);
  }
  if (mantenimiento_id) {
    where.push(`h.mantenimiento_id = $${i++}`);
    params.push(mantenimiento_id);
  }

  if (accion) {
    if (Array.isArray(accion)) {
      where.push(`h.accion = ANY($${i++})`);
      params.push(accion);
    } else if (typeof accion === "string" && accion.includes(",")) {
      const arr = accion.split(",").map(s => s.trim()).filter(Boolean);
      where.push(`h.accion = ANY($${i++})`);
      params.push(arr);
    } else {
      where.push(`h.accion = $${i++}`);
      params.push(String(accion));
    }
  }

  if (desde) { where.push(`h.creado_en >= $${i++}`); params.push(desde); }
  if (hasta) { where.push(`h.creado_en <  $${i++}`); params.push(hasta); }
  if (q)     { where.push(`h.detalle::text ILIKE $${i++}`); params.push(`%${q}%`); }

  const sql = `
  SELECT
    h.id,
    h.mantenimiento_id,
    h.equipo_id,
    h.laboratorio_id,
    l.nombre AS laboratorio_nombre,          -- ← NUEVO
    h.usuario_id,
    u.nombre AS usuario_nombre,
    u.correo AS usuario_correo,
    h.accion,
    h.detalle,
    h.creado_en
  FROM historial_mantenimientos h
  LEFT JOIN users u        ON u.id = h.usuario_id
  LEFT JOIN laboratorios l ON l.id = h.laboratorio_id   -- ← NUEVO
  WHERE ${where.join(" AND ")}
  ORDER BY h.creado_en DESC, h.id DESC
  LIMIT $${i} OFFSET $${i + 1}
`;
  params.push(limit, offset);

  const { rows } = await pool.query(sql, params);
  return rows;
}
