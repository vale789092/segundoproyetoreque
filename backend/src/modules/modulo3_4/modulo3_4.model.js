// backend/src/modules/modulo3_4/modulo3_4.model.js
import { pool } from "../../db/index.js";

/**
 * Devuelve cronología del usuario autenticado como lista de eventos
 * soporta filtros por rango y tipo.
 */
export async function getMyUsage({ userId, from, to, tipo = "all" }) {
  // Rango por defecto: últimos 90 días
  const qFrom = from ?? new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString();
  const qTo   = to   ?? new Date().toISOString();

  // Descomponemos filtro de tipo en flags
  const wantSolic = (tipo === "all" || tipo === "solicitudes");
  const wantUso   = (tipo === "all" || tipo === "uso");
  const wantDevol = (tipo === "all" || tipo === "devolucion");

  // Construimos UNION solo con las partes necesarias
  const parts = [];
  const params = [userId, qFrom, qTo];

  if (wantSolic) {
    // solicitud creada
    parts.push(`
      SELECT s.id            AS solicitud_id,
             'solicitud_creada'::text AS tipo_evento,
             s.creada_en     AS ts,
             s.estado,
             l.id            AS laboratorio_id,
             l.nombre        AS laboratorio,
             e.id            AS recurso_id,
             e.nombre        AS recurso
      FROM solicitudes s
      JOIN laboratorios l ON l.id = s.laboratorio_id
      JOIN equipos_fijos e ON e.id = s.recurso_id
      WHERE s.usuario_id = $1 AND s.creada_en BETWEEN $2 AND $3
    `);
    // solicitud aprobada
    parts.push(`
      SELECT s.id, 'solicitud_aprobada', s.aprobada_en, s.estado, l.id, l.nombre, e.id, e.nombre
      FROM solicitudes s
      JOIN laboratorios l ON l.id = s.laboratorio_id
      JOIN equipos_fijos e ON e.id = s.recurso_id
      WHERE s.usuario_id = $1 AND s.aprobada_en IS NOT NULL AND s.aprobada_en BETWEEN $2 AND $3
    `);
  }

  if (wantUso) {
    // uso (inicio)
    parts.push(`
      SELECT s.id, 'uso_inicio', s.fecha_uso_inicio, s.estado, l.id, l.nombre, e.id, e.nombre
      FROM solicitudes s
      JOIN laboratorios l ON l.id = s.laboratorio_id
      JOIN equipos_fijos e ON e.id = s.recurso_id
      WHERE s.usuario_id = $1 AND s.fecha_uso_inicio BETWEEN $2 AND $3
    `);
    // uso (fin)
    parts.push(`
      SELECT s.id, 'uso_fin', s.fecha_uso_fin, s.estado, l.id, l.nombre, e.id, e.nombre
      FROM solicitudes s
      JOIN laboratorios l ON l.id = s.laboratorio_id
      JOIN equipos_fijos e ON e.id = s.recurso_id
      WHERE s.usuario_id = $1 AND s.fecha_uso_fin BETWEEN $2 AND $3
    `);
  }

  if (wantDevol) {
    // devolución programada/registrada (si ya existe aprobada_en → trigger calculó fecha_devolucion)
    parts.push(`
      SELECT s.id, 'devolucion', s.fecha_devolucion, s.estado, l.id, l.nombre, e.id, e.nombre
      FROM solicitudes s
      JOIN laboratorios l ON l.id = s.laboratorio_id
      JOIN equipos_fijos e ON e.id = s.recurso_id
      WHERE s.usuario_id = $1 AND s.fecha_devolucion IS NOT NULL AND s.fecha_devolucion BETWEEN $2 AND $3
    `);
  }

  if (parts.length === 0) return [];

  const sql = `
    ${parts.join(" UNION ALL ")}
    ORDER BY ts DESC, solicitud_id DESC
    LIMIT 2000
  `;

  const { rows } = await pool.query(sql, params);
  return rows.map((r) => ({
    solicitud_id: r.solicitud_id,
    tipo_evento : r.tipo_evento,
    ts          : r.ts,
    estado      : r.estado,
    laboratorio : { id: r.laboratorio_id, nombre: r.laboratorio },
    recurso     : { id: r.recurso_id, nombre: r.recurso },
  }));
}

export async function listMyHistory({ usuario_id, desde, hasta, tipo }) {
  const params = [usuario_id];
  const ranges = [];
  if (desde) { params.push(desde); ranges.push(`h.creado_en >= $${params.length}`); }
  if (hasta) { params.push(hasta); ranges.push(`h.creado_en <  $${params.length}`); }

  // tipo opcional: 'reserva','prestamo','devolucion','capacitacion','otro'
  const tipoFilter = tipo ? `AND (h.detalle->>'tipo') = $${params.push(tipo)}` : "";

  const where = [`h.usuario_id = $1`, ...ranges];

  const { rows } = await pool.query(
    `SELECT
       h.id, h.laboratorio_id, h.usuario_id, h.accion, h.detalle, h.creado_en,
       l.nombre AS lab_nombre
     FROM historial_laboratorio h
     JOIN laboratorios l ON l.id = h.laboratorio_id
    WHERE ${where.join(" AND ")} ${tipoFilter}
    ORDER BY h.creado_en DESC, h.id DESC`,
    params
  );
  return rows;
}

// ========= Reportes institucionales (todos los labs) =========

// Por periodo académico (I: ene-jun, II: jul-dic)
const periodoExpr = `
  CASE
    WHEN EXTRACT(MONTH FROM ts) BETWEEN 1 AND 6 THEN CONCAT(EXTRACT(YEAR FROM ts)::text, ' - I')
    ELSE CONCAT(EXTRACT(YEAR FROM ts)::text, ' - II')
  END
`;

// Uso global por periodo académico (reservas / préstamos / mantenimientos)
export async function getGlobalUsage({ from, to }) {
  const f = from ?? new Date(Date.now() - 365 * 24 * 3600 * 1000).toISOString();
  const t = to   ?? new Date().toISOString();

  // Normalizamos “ts” de cada tipo de evento sin filtrar por usuario
  const unions = `
    SELECT s.creada_en        AS ts, 'reserva'       AS tipo FROM solicitudes s
      WHERE s.creada_en BETWEEN $1 AND $2
    UNION ALL
    SELECT s.fecha_uso_inicio AS ts, 'prestamo'      AS tipo FROM solicitudes s
      WHERE s.fecha_uso_inicio BETWEEN $1 AND $2
    UNION ALL
    SELECT m.creado_en        AS ts, 'mantenimiento' AS tipo FROM mantenimientos m
      WHERE m.creado_en BETWEEN $1 AND $2
  `;

  const sql = `
    WITH eventos AS (${unions})
    SELECT ${periodoExpr} AS periodo,
           SUM(CASE WHEN tipo='reserva' THEN 1 ELSE 0 END)       AS reservas,
           SUM(CASE WHEN tipo='prestamo' THEN 1 ELSE 0 END)      AS prestamos,
           SUM(CASE WHEN tipo='mantenimiento' THEN 1 ELSE 0 END) AS mantenimientos
    FROM eventos
    GROUP BY periodo
    ORDER BY MIN(ts) ASC
  `;

  const { rows } = await pool.query(sql, [f, t]);
  return rows;
}

// Snapshot de inventario institucional (todos los recursos visibles)
export async function getInventorySnapshot() {
  const { rows } = await pool.query(`
    SELECT
      l.id              AS lab_id,
      l.nombre          AS lab_nombre,
      e.id              AS recurso_id,
      e.nombre          AS recurso_nombre,
      COALESCE(e.estado, 'disponible') AS estado,
      COALESCE(e.ubicacion, '')        AS ubicacion
    FROM laboratorios l
    JOIN equipos_fijos e ON e.laboratorio_id = l.id
    ORDER BY l.nombre, e.nombre
  `);
  return rows;
}
