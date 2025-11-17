// backend/src/modules/modulo2_4/modulo2_4.mant.model.js
import { pool } from "../../db/index.js";

/**
 * Reporte de mantenimientos por equipo o por laboratorio.
 * Filtros:
 *  - lab_id (uno)  o lab_ids (CSV)
 *  - from / to (ISO). Por defecto últimos 90 días.
 *  - tipo (preventivo|correctivo|calibracion|inspeccion|otro) opcional
 *  - group: 'equipo' (default) | 'lab'
 *
 * Métricas (por equipo):
 *  - mantenimientos (frecuencia en el rango)
 *  - downtime_hours (suma de intervalos add_equipo→remove_equipo, recortados al rango)
 *  - avg_downtime_hours (downtime_hours / mantenimientos si > 0)
 *  - primero_en_rango / ultimo_en_rango
 */
export async function getMaintenanceReport({
  lab_id,
  lab_ids,
  from,
  to,
  tipo,
  group = "equipo",
} = {}) {
  const labs = [];
  if (lab_id) labs.push(String(lab_id));
  if (lab_ids) {
    const parts = String(lab_ids)
      .split(",")
      .map(s => s.trim())
      .filter(Boolean);
    labs.push(...parts);
  }
  const hasLabs = labs.length > 0;

  const qFrom = from ?? new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString();
  const qTo   = to   ?? new Date().toISOString();

  // ---------- FRECUENCIA (mantenimientos por equipo en el rango) ----------
  {
    // build WHERE dinámico
  }
  const whereFreq = [];
  const pFreq = [];

  if (hasLabs) { whereFreq.push(`e.laboratorio_id = ANY($${pFreq.length + 1})`); pFreq.push(labs); }
  // Rango por fecha programada
  whereFreq.push(`m.programado_para BETWEEN $${pFreq.length + 1} AND $${pFreq.length + 2}`); pFreq.push(qFrom, qTo);
  if (tipo) { whereFreq.push(`m.tipo = $${pFreq.length + 1}`); pFreq.push(tipo); }

  const sqlFreq = `
    SELECT
      e.laboratorio_id,
      l.nombre                      AS lab_nombre,
      e.id                          AS equipo_id,
      e.codigo_inventario,
      e.nombre                      AS equipo_nombre,
      COUNT(DISTINCT m.id)          AS mantenimientos,
      MIN(m.programado_para)        AS primero_en_rango,
      MAX(m.programado_para)        AS ultimo_en_rango
    FROM mantenimiento_recursos mr
    JOIN equipos_fijos e   ON e.id = mr.equipo_id
    JOIN laboratorios l    ON l.id = e.laboratorio_id
    JOIN mantenimientos m  ON m.id = mr.mantenimiento_id
    WHERE ${whereFreq.join(" AND ")}
    GROUP BY e.laboratorio_id, l.nombre, e.id, e.codigo_inventario, e.nombre
  `;
  const { rows: freqRows } = await pool.query(sqlFreq, pFreq);

  // ---------- DOWNTIME (intervalos add_equipo → remove_equipo, recortados a [from,to]) ----------
  // Tomamos eventos hasta 'to' (para cerrar intervalos pendientes en 'to').
  const pDown = [];
  if (hasLabs) pDown.push(labs);
  pDown.push(qFrom, qTo); // usaremos ambos en la CTE

  const sqlDown = `
    WITH ev AS (
      SELECT
        hm.equipo_id,
        e.laboratorio_id,
        hm.mantenimiento_id,
        hm.creado_en AS ts,
        (hm.detalle->>'op') AS op
      FROM historial_mantenimientos hm
      JOIN equipos_fijos e ON e.id = hm.equipo_id
      WHERE hm.accion = 'actualizado'
        AND (hm.detalle->>'op') IN ('add_equipo','remove_equipo')
        ${hasLabs ? `AND e.laboratorio_id = ANY($1)` : ``}
        AND hm.creado_en <= $${hasLabs ? 3 : 2}
    ),
    ord AS (
      SELECT
        equipo_id, laboratorio_id, mantenimiento_id, ts, op,
        LEAD(ts) OVER (PARTITION BY mantenimiento_id, equipo_id ORDER BY ts) AS ts_next,
        LEAD(op) OVER (PARTITION BY mantenimiento_id, equipo_id ORDER BY ts) AS op_next
      FROM ev
    ),
    pairs AS (
      SELECT
        equipo_id, laboratorio_id,
        GREATEST(ts, $${hasLabs ? 2 : 1}::timestamptz) AS start_ts,
        LEAST(
          COALESCE(CASE WHEN op_next = 'remove_equipo' THEN ts_next END, $${hasLabs ? 3 : 2}::timestamptz),
          $${hasLabs ? 3 : 2}::timestamptz
        ) AS end_ts
      FROM ord
      WHERE op = 'add_equipo'
    ),
    agg AS (
      SELECT
        equipo_id, laboratorio_id,
        SUM( GREATEST(0, EXTRACT(EPOCH FROM (end_ts - start_ts))) ) AS downtime_s
      FROM pairs
      WHERE end_ts > start_ts
      GROUP BY equipo_id, laboratorio_id
    )
    SELECT * FROM agg
  `;
  const { rows: downRows } = await pool.query(sqlDown, pDown);

  // ---------- Merge por equipo ----------
  const downByEquipo = new Map();
  for (const r of downRows) {
    downByEquipo.set(String(r.equipo_id), Number(r.downtime_s || 0));
  }

  const perEquipo = freqRows.map(r => {
    const downtime_s = downByEquipo.get(String(r.equipo_id)) ?? 0;
    const downtime_hours = downtime_s / 3600;
    const mantenimientos = Number(r.mantenimientos || 0);
    const avg_downtime_hours = mantenimientos > 0 ? (downtime_hours / mantenimientos) : 0;
    return {
      lab: {
        id: r.laboratorio_id,
        nombre: r.lab_nombre
      },
      equipo: {
        id: r.equipo_id,
        codigo: r.codigo_inventario,
        nombre: r.equipo_nombre
      },
      mantenimientos,
      downtime_hours: Number(downtime_hours.toFixed(3)),
      avg_downtime_hours: Number(avg_downtime_hours.toFixed(3)),
      primero_en_rango: r.primero_en_rango,
      ultimo_en_rango: r.ultimo_en_rango,
      period_from: qFrom,
      period_to: qTo,
      tipo: tipo || null
    };
  });

  if (group === "lab") {
    // Agregar por laboratorio
    const byLab = new Map();
    for (const row of perEquipo) {
      const key = String(row.lab.id);
      if (!byLab.has(key)) {
        byLab.set(key, {
          lab: row.lab,
          equipos: 0,
          mantenimientos: 0,
          downtime_hours: 0
        });
      }
      const acc = byLab.get(key);
      acc.equipos += 1;
      acc.mantenimientos += row.mantenimientos;
      acc.downtime_hours += row.downtime_hours;
    }
    // promedio por mantenimiento en el nivel laboratorio
    const out = [];
    for (const acc of byLab.values()) {
      const avg_downtime_hours =
        acc.mantenimientos > 0 ? acc.downtime_hours / acc.mantenimientos : 0;
      out.push({
        lab: acc.lab,
        equipos: acc.equipos,
        mantenimientos: acc.mantenimientos,
        downtime_hours: Number(acc.downtime_hours.toFixed(3)),
        avg_downtime_hours: Number(avg_downtime_hours.toFixed(3)),
        period_from: qFrom,
        period_to: qTo,
        tipo: tipo || null
      });
    }
    // Ordenar por más downtime
    out.sort((a, b) => b.downtime_hours - a.downtime_hours);
    return out;
  }

  // Orden por mayor downtime en vista por equipo
  perEquipo.sort((a, b) => b.downtime_hours - a.downtime_hours);
  return perEquipo;
}
