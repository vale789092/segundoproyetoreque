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
