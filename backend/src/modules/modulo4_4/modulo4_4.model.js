import { pool } from "../../db/index.js";

/**
 * Periodos académicos:
 *  - S1 = meses 1..6  (Ene–Jun)
 *  - S2 = meses 7..12 (Jul–Dic)
 *
 * from/to: ISO (opcionales). Si son null, no filtra.
 * prestamos = reservas_aprobadas (desde historial_laboratorio).
 */
export async function getGlobalUsage({ from = null, to = null } = {}) {
  const sql = `
    WITH lab AS (
      SELECT
        CASE
          WHEN EXTRACT(MONTH FROM h.creado_en) BETWEEN 1 AND 6
            THEN CONCAT(EXTRACT(YEAR FROM h.creado_en)::int, '-S1')
          ELSE CONCAT(EXTRACT(YEAR FROM h.creado_en)::int, '-S2')
        END AS periodo,
        COUNT(*) FILTER (WHERE h.accion IN ('reserva_creada','reserva_aprobada','reserva_rechazada')) AS reservas_total,
        COUNT(*) FILTER (WHERE h.accion = 'reserva_creada')    AS reservas_creadas,
        COUNT(*) FILTER (WHERE h.accion = 'reserva_aprobada')  AS reservas_aprobadas, -- préstamos
        COUNT(*) FILTER (WHERE h.accion = 'reserva_rechazada') AS reservas_rechazadas
      FROM historial_laboratorio h
      WHERE ($1::timestamptz IS NULL OR h.creado_en >= $1)
        AND ($2::timestamptz IS NULL OR h.creado_en <  $2)
      GROUP BY periodo
    ),
    mant AS (
      SELECT
        CASE
          WHEN EXTRACT(MONTH FROM hm.creado_en) BETWEEN 1 AND 6
            THEN CONCAT(EXTRACT(YEAR FROM hm.creado_en)::int, '-S1')
          ELSE CONCAT(EXTRACT(YEAR FROM hm.creado_en)::int, '-S2')
        END AS periodo,
        COUNT(*)                                           AS mant_eventos,
        COUNT(*) FILTER (WHERE hm.accion='programado')     AS mant_programados,
        COUNT(*) FILTER (WHERE hm.accion='completado')     AS mant_completados,
        COUNT(DISTINCT CASE WHEN hm.mantenimiento_id IS NOT NULL THEN hm.mantenimiento_id END) AS mant_unicos,
        COUNT(DISTINCT CASE WHEN hm.accion='completado' AND hm.mantenimiento_id IS NOT NULL THEN hm.mantenimiento_id END) AS mant_completados_unicos
      FROM historial_mantenimientos hm
      WHERE ($1::timestamptz IS NULL OR hm.creado_en >= $1)
        AND ($2::timestamptz IS NULL OR hm.creado_en <  $2)
      GROUP BY periodo
    )
    SELECT
      COALESCE(l.periodo, m.periodo)                                   AS periodo,
      SPLIT_PART(COALESCE(l.periodo, m.periodo), '-', 1)::int          AS anio,
      CASE WHEN RIGHT(COALESCE(l.periodo, m.periodo), 2)='S1' THEN 1 ELSE 2 END AS semestre,
      COALESCE(l.reservas_total, 0)         AS reservas_total,
      COALESCE(l.reservas_creadas, 0)       AS reservas_creadas,
      COALESCE(l.reservas_aprobadas, 0)     AS reservas_aprobadas,    -- préstamos
      COALESCE(l.reservas_rechazadas, 0)    AS reservas_rechazadas,
      COALESCE(m.mant_eventos, 0)           AS mant_eventos,
      COALESCE(m.mant_programados, 0)       AS mant_programados,
      COALESCE(m.mant_completados, 0)       AS mant_completados,
      COALESCE(m.mant_unicos, 0)            AS mant_unicos,
      COALESCE(m.mant_completados_unicos,0) AS mant_completados_unicos
    FROM lab l
    FULL OUTER JOIN mant m ON m.periodo = l.periodo
    ORDER BY anio ASC, semestre ASC
  `;
  const { rows } = await pool.query(sql, [from, to]);
  return rows.map(r => ({
    ...r,
    prestamos: r.reservas_aprobadas, // alias semántico
  }));
}

/**
 * Inventario institucional (toda la tabla equipos_fijos, sin filtro por laboratorio).
 * Filtros opcionales por conveniencia: tipo, estado_operativo, estado_disp, reservable, q (búsqueda).
 */
export async function listInstitutionInventory({
  tipo,
  estado_operativo,
  estado_disp,
  reservable, // true/false
  q,          // busca en nombre/codigo/lab/ubicacion
} = {}) {
  const where = [];
  const params = [];
  let i = 1;

  if (tipo)              { where.push(`e.tipo = $${i++}`);              params.push(tipo); }
  if (estado_operativo)  { where.push(`e.estado_operativo = $${i++}`);  params.push(estado_operativo); }
  if (estado_disp)       { where.push(`e.estado_disp = $${i++}`);       params.push(estado_disp); }
  if (reservable !== undefined) {
    where.push(`e.reservable = $${i++}`);
    params.push(!!reservable);
  }
  if (q) {
    where.push(`(
      e.nombre ILIKE $${i} OR e.codigo_inventario ILIKE $${i} OR
      l.nombre ILIKE $${i} OR l.ubicacion ILIKE $${i}
    )`);
    params.push(`%${q}%`); i++;
  }

  const sql = `
    SELECT
      e.id,
      e.laboratorio_id,
      l.nombre     AS laboratorio_nombre,
      l.ubicacion  AS laboratorio_ubicacion,
      l.codigo_interno AS laboratorio_codigo,

      e.codigo_inventario,
      e.nombre     AS recurso_nombre,
      e.tipo,
      e.estado_operativo,
      e.estado_disp,
      e.cantidad_total,
      e.cantidad_disponible,
      e.reservable,
      e.fecha_ultimo_mant,
      e.ficha_tecnica,
      e.fotos,
      e.created_at,
      e.updated_at
    FROM equipos_fijos e
    JOIN laboratorios l ON l.id = e.laboratorio_id
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY l.nombre ASC, e.nombre ASC, e.codigo_inventario ASC
  `;

  const { rows } = await pool.query(sql, params);
  return rows;
}