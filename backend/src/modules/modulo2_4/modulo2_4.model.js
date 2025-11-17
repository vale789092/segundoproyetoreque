// backend/src/modules/modulo2_4/modulo2_4.model.js
import { pool } from "../../db/index.js";

/**
 * Reporte de inventario con filtros y métricas:
 * - filtros: laboratorio_id, tipo, estado_disp, reservable, from, to
 * - métricas: usos_periodo (solicitudes aprobadas que cruzan el rango),
 *             porcentaje_disp, critico (por cantidad y/o porcentaje)
 */
export async function getInventoryReport({
  laboratorio_id,
  tipo,
  estado_disp,
  reservable,
  from,
  to,
  critical_qty = 1,      // recursos críticos por cantidad disponible ≤ critical_qty
  critical_pct = 0.2,    // o por porcentaje disponible ≤ 20% (0.2)
} = {}) {
  const qFrom = from ?? new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString();
  const qTo   = to   ?? new Date().toISOString();

  const where = ["1=1"];
  const params = [];
  let i = 1;

  if (laboratorio_id) { where.push(`e.laboratorio_id = $${i++}`); params.push(laboratorio_id); }
  if (tipo)           { where.push(`e.tipo = $${i++}`);           params.push(tipo); }
  if (estado_disp)    { where.push(`e.estado_disp = $${i++}`);    params.push(estado_disp); }
  if (reservable !== undefined) { where.push(`e.reservable = $${i++}`); params.push(!!(reservable === true || reservable === "true")) }

  // Nota de consumo: lo definimos como "uso" (reservas aprobadas que cruzan el rango)
  // cruzan rango si inicio < qTo y fin >= qFrom
  const sql = `
    SELECT
      e.id,
      e.laboratorio_id,
      l.nombre             AS lab_nombre,
      e.codigo_inventario,
      e.nombre,
      e.tipo,
      e.estado_operativo,
      e.estado_disp,
      e.cantidad_total,
      e.cantidad_disponible,
      e.reservable,
      e.fecha_ultimo_mant,
      e.updated_at,
      COALESCE(u.usos, 0)  AS usos_periodo
    FROM equipos_fijos e
    JOIN laboratorios l ON l.id = e.laboratorio_id
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS usos
      FROM solicitudes s
      WHERE s.recurso_id = e.id
        AND s.estado = 'aprobada'
        AND s.fecha_uso_inicio < $${i+1}
        AND s.fecha_uso_fin    >= $${i}
    ) u ON true
    WHERE ${where.join(" AND ")}
    ORDER BY l.nombre ASC, e.nombre ASC
  `;

  const { rows } = await pool.query(sql, [...params, qFrom, qTo]);

  // Enriquecer con % y criticidad
  return rows.map(r => {
    const total = Number(r.cantidad_total) || 0;
    const disp  = Number(r.cantidad_disponible) ?? 0;
    const pct   = total > 0 ? disp / total : 0;
    const crit  = (disp <= Number(critical_qty)) || (pct <= Number(critical_pct));
    return {
      ...r,
      porcentaje_disp: pct,     // 0..1
      critico: crit,
      period_from: qFrom,
      period_to: qTo,
    };
  });
}
