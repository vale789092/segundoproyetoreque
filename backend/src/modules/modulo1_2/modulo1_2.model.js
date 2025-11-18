import { pool } from "../../db/index.js";

/** Tablas / columnas */
const TB = {
  labs: "laboratorios",
  horarios: "laboratorio_horarios",
  bloqueos: "laboratorio_bloqueos",
  history: "historial_laboratorio",
  users: "users",
  solicitudes: "solicitudes",  // <--- NUEVO
};

const COL = {
  labs: { id: "id" },
  horarios: {
    id: "id",
    labId: "laboratorio_id",
    dow: "dow",
    inicio: "hora_inicio",
    fin: "hora_fin",
    capacidad: "capacidad_maxima",
  },
  bloqueos: {
    id: "id",
    labId: "laboratorio_id",
    titulo: "titulo",
    tipo: "tipo",
    ts_inicio: "ts_inicio",
    ts_fin: "ts_fin",
    descripcion: "descripcion",
    creadoPor: "creado_por",
  },
  users: { id: "id", nombre: "nombre", correo: "correo" },
  history: {
    id: "id",
    labId: "laboratorio_id",
    accion: "accion",
    userId: "usuario_id",
    detalle: "detalle",
    creado: "creado_en",
  },
    solicitudes: {
    id: "id",
    labId: "laboratorio_id",
    inicio: "fecha_uso_inicio",
    fin: "fecha_uso_fin",
    estado: "estado",
  },
};

const DOW_VALIDOS = new Set([0, 1, 2, 3, 4, 5, 6]);

/* ---------- Utilidades ---------- */
export async function assertLabExists(labId) {
  const { rowCount } = await pool.query(
    `SELECT 1 FROM ${TB.labs} WHERE ${COL.labs.id}=$1`,
    [labId]
  );
  if (!rowCount) {
    const err = new Error("Laboratorio no existe");
    err.code = "23503";
    throw err;
  }
}

/** Verifica que no exista traslape con otras franjas del mismo lab/dow */
async function assertNoOverlapHorario(
  labId,
  dow,
  hora_inicio,
  hora_fin,
  excludeId = null
) {
  const params = [labId, dow, hora_inicio, hora_fin];
  let sql = `
    SELECT 1
      FROM ${TB.horarios}
     WHERE ${COL.horarios.labId}=$1
       AND ${COL.horarios.dow}=$2
       AND NOT (${COL.horarios.fin} <= $3 OR ${COL.horarios.inicio} >= $4)
  `;
  if (excludeId) {
    params.push(excludeId);
    sql += ` AND ${COL.horarios.id} <> $5`;
  }
  const { rowCount } = await pool.query(sql, params);
  if (rowCount) {
    const e = new Error("Franja horaria traslapa con otra existente");
    e.code = "OVERLAP_SLOT";
    throw e;
  }
}

/** Registrar en bitácora sin romper la operación principal */
async function logHistorySafe(labId, accion, detalleObj, actorId = null) {
  try {
    await pool.query(
      `INSERT INTO ${TB.history} (${COL.history.labId}, ${COL.history.userId}, ${COL.history.accion}, ${COL.history.detalle})
       VALUES ($1,$2,$3,$4)`,
      [labId, actorId, accion, JSON.stringify(detalleObj)]
    );
  } catch (e) {
    console.error("[HIST] fallo registro:", e.code || e.message);
  }
}

const TIPOS_BLOQUEO = new Set([
  "evento",
  "mantenimiento",
  "uso_exclusivo",
  "bloqueo",
]);

function buildTimestampFromDateTime(fecha, hora) {
  if (!fecha || !hora) return null;
  const t = hora.length === 5 ? `${hora}:00` : hora; // 08:00 -> 08:00:00
  return `${fecha}T${t}`; // Postgres lo castea a timestamptz
}

/* ---------- Bloqueos ---------- */
export async function createBloqueo(labId, payload, actorId) {
  await assertLabExists(labId);

  const titulo = String(payload.titulo || "").trim();
  const tipo = String(payload.tipo || "").trim();

  let ts_inicio = payload.ts_inicio;
  let ts_fin = payload.ts_fin;

  if (!ts_inicio || !ts_fin) {
    const fecha = String(payload.fecha || "").trim();
    const hora_inicio = String(payload.hora_inicio || "").trim();
    const hora_fin = String(payload.hora_fin || "").trim();
    ts_inicio = buildTimestampFromDateTime(fecha, hora_inicio);
    ts_fin = buildTimestampFromDateTime(fecha, hora_fin);
  }

  if (!titulo) {
    const e = new Error("titulo es requerido");
    e.code = "22P02";
    throw e;
  }
  if (!TIPOS_BLOQUEO.has(tipo)) {
    const e = new Error("tipo de bloqueo inválido");
    e.code = "22P02";
    throw e;
  }
  if (!ts_inicio || !ts_fin) {
    const e = new Error(
      "ts_inicio/ts_fin o fecha/hora_inicio/hora_fin son requeridos"
    );
    e.code = "22P02";
    throw e;
  }

  const ini = new Date(ts_inicio);
  const fin = new Date(ts_fin);
  if (!(fin > ini)) {
    const e = new Error("ts_fin debe ser mayor que ts_inicio");
    e.code = "22P02";
    throw e;
  }

  const { rows } = await pool.query(
    `INSERT INTO ${TB.bloqueos}
       (${COL.bloqueos.labId},
        ${COL.bloqueos.titulo},
        ${COL.bloqueos.tipo},
        ${COL.bloqueos.ts_inicio},
        ${COL.bloqueos.ts_fin},
        ${COL.bloqueos.descripcion},
        ${COL.bloqueos.creadoPor})
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING ${COL.bloqueos.id} AS id`,
    [
      labId,
      titulo,
      tipo,
      ts_inicio,
      ts_fin,
      payload.descripcion || null,
      actorId,
    ]
  );

  await logHistorySafe(
    labId,
    "actualizacion_lab",
    {
      tipo: "bloqueo",
      op: "creado",
      id: rows[0].id,
      titulo,
      tipo,
      ts_inicio,
      ts_fin,
    },
    actorId
  );

  return { id: rows[0].id };
}

export async function deleteBloqueo(labId, bloqueoId, actorId) {
  await assertLabExists(labId);
  const { rowCount } = await pool.query(
    `DELETE FROM ${TB.bloqueos}
      WHERE ${COL.bloqueos.labId}=$1
        AND ${COL.bloqueos.id}=$2`,
    [labId, bloqueoId]
  );

  if (rowCount) {
    await logHistorySafe(
      labId,
      "actualizacion_lab",
      { tipo: "bloqueo", op: "eliminado", id: bloqueoId },
      actorId
    );
  }
  return !!rowCount;
}

export async function listBloqueos(labId, { desde, hasta } = {}) {
  await assertLabExists(labId);

  let sql = `
    SELECT
      ${COL.bloqueos.id}         AS id,
      ${COL.bloqueos.titulo}     AS titulo,
      ${COL.bloqueos.tipo}       AS tipo,
      ${COL.bloqueos.ts_inicio}  AS ts_inicio,
      ${COL.bloqueos.ts_fin}     AS ts_fin,
      ${COL.bloqueos.descripcion} AS descripcion
    FROM ${TB.bloqueos}
    WHERE ${COL.bloqueos.labId} = $1`;
  const params = [labId];
  let i = 2;

  if (desde) {
    sql += ` AND ${COL.bloqueos.ts_fin} >= $${i++}::timestamptz`;
    params.push(desde);
  }
  if (hasta) {
    sql += ` AND ${COL.bloqueos.ts_inicio} <= $${i++}::timestamptz`;
    params.push(hasta);
  }

  sql += ` ORDER BY ${COL.bloqueos.ts_inicio}`;
  const { rows } = await pool.query(sql, params);
  return rows;
}

export async function listBloqueosDia(labId, fechaStr) {
  await assertLabExists(labId);

  const { rows } = await pool.query(
    `SELECT
       ${COL.bloqueos.id}         AS id,
       ${COL.bloqueos.titulo}     AS titulo,
       ${COL.bloqueos.tipo}       AS tipo,
       ${COL.bloqueos.ts_inicio}  AS ts_inicio,
       ${COL.bloqueos.ts_fin}     AS ts_fin,
       ${COL.bloqueos.descripcion} AS descripcion
     FROM ${TB.bloqueos}
    WHERE ${COL.bloqueos.labId} = $1
      AND ${COL.bloqueos.ts_inicio} < $2::date + INTERVAL '1 day'
      AND ${COL.bloqueos.ts_fin}    > $2::date
    ORDER BY ${COL.bloqueos.ts_inicio}`,
    [labId, fechaStr]
  );

  return rows;
}

/* ---------- Reservas aprobadas (solicitudes) ---------- */
export async function listReservasDia(labId, fechaStr) {
  await assertLabExists(labId);

  const { rows } = await pool.query(
    `SELECT
       ${COL.solicitudes.id}     AS id,
       ${COL.solicitudes.inicio} AS fecha_uso_inicio,
       ${COL.solicitudes.fin}    AS fecha_uso_fin,
       ${COL.solicitudes.estado} AS estado
     FROM ${TB.solicitudes}
    WHERE ${COL.solicitudes.labId} = $1
      AND ${COL.solicitudes.estado} = 'aprobada'
      AND ${COL.solicitudes.inicio} < $2::date + INTERVAL '1 day'
      AND ${COL.solicitudes.fin}    > $2::date`,
    [labId, fechaStr]
  );

  return rows;
}

/* ---------- 1.2.1 CRUD de horario base ---------- */
export async function createHorario(
  labId,
  { dow, hora_inicio, hora_fin, capacidad_maxima },
  actorId
) {
  await assertLabExists(labId);

  const d = Number(dow);
  if (!Number.isInteger(d) || !DOW_VALIDOS.has(d)) {
    const e = new Error("dow debe estar entre 0 (domingo) y 6 (sábado)");
    e.code = "22P02";
    throw e;
  }
  if (!hora_inicio || !hora_fin) {
    const e = new Error("hora_inicio y hora_fin son requeridos");
    e.code = "22P02";
    throw e;
  }
  if (!(Number(capacidad_maxima) > 0)) {
    const e = new Error("capacidad_maxima debe ser > 0");
    e.code = "22P02";
    throw e;
  }

  await assertNoOverlapHorario(labId, d, hora_inicio, hora_fin);

  const { rows } = await pool.query(
    `INSERT INTO ${TB.horarios}
       (${COL.horarios.labId}, ${COL.horarios.dow}, ${COL.horarios.inicio}, ${COL.horarios.fin}, ${COL.horarios.capacidad})
     VALUES ($1,$2,$3,$4,$5)
     RETURNING ${COL.horarios.id} AS id`,
    [labId, d, hora_inicio, hora_fin, capacidad_maxima]
  );

  await logHistorySafe(
    labId,
    "actualizacion_lab",
    {
      tipo: "horario",
      op: "creado",
      id: rows[0].id,
      dow: d,
      hora_inicio,
      hora_fin,
      capacidad_maxima,
    },
    actorId
  );
  return { id: rows[0].id };
}

// listar franjas por DOW
export async function listHorariosByDow(labId, dow) {
  await assertLabExists(labId);
  const { rows } = await pool.query(
    `SELECT
       ${COL.horarios.id}       AS id,
       ${COL.horarios.dow}      AS dow,
       ${COL.horarios.inicio}   AS hora_inicio,
       ${COL.horarios.fin}      AS hora_fin,
       ${COL.horarios.capacidad} AS capacidad_maxima
     FROM ${TB.horarios}
    WHERE ${COL.horarios.labId}=$1 AND ${COL.horarios.dow}=$2
    ORDER BY ${COL.horarios.inicio} ASC, ${COL.horarios.id} ASC`,
    [labId, dow]
  );
  return rows;
}

// listar todo el horario base de un lab
export async function listHorarios(labId) {
  await assertLabExists(labId);
  const { rows } = await pool.query(
    `SELECT
       ${COL.horarios.id}       AS id,
       ${COL.horarios.dow}      AS dow,
       ${COL.horarios.inicio}   AS hora_inicio,
       ${COL.horarios.fin}      AS hora_fin,
       ${COL.horarios.capacidad} AS capacidad_maxima
     FROM ${TB.horarios}
    WHERE ${COL.horarios.labId} = $1
    ORDER BY ${COL.horarios.dow} ASC,
             ${COL.horarios.inicio} ASC,
             ${COL.horarios.id} ASC`,
    [labId]
  );
  return rows;
}

// Actualizar franja
export async function updateHorario(labId, slotId, patch = {}, actorId) {
  await assertLabExists(labId);

  const current = (
    await pool.query(
      `SELECT ${COL.horarios.dow} AS dow,
              ${COL.horarios.inicio} AS hora_inicio,
              ${COL.horarios.fin} AS hora_fin
         FROM ${TB.horarios}
        WHERE ${COL.horarios.labId}=$1 AND ${COL.horarios.id}=$2`,
      [labId, slotId]
    )
  ).rows[0];
  if (!current) return null;

  const next = {
    dow: patch.dow !== undefined ? Number(patch.dow) : Number(current.dow),
    hora_inicio:
      patch.hora_inicio !== undefined ? patch.hora_inicio : current.hora_inicio,
    hora_fin:
      patch.hora_fin !== undefined ? patch.hora_fin : current.hora_fin,
  };

  if (!Number.isInteger(next.dow) || !DOW_VALIDOS.has(next.dow)) {
    const e = new Error("dow debe estar entre 0 y 6");
    e.code = "22P02";
    throw e;
  }
  if (
    patch.capacidad_maxima !== undefined &&
    !(Number(patch.capacidad_maxima) > 0)
  ) {
    const e = new Error("capacidad_maxima debe ser > 0");
    e.code = "22P02";
    throw e;
  }

  await assertNoOverlapHorario(
    labId,
    next.dow,
    next.hora_inicio,
    next.hora_fin,
    slotId
  );

  const sets = [];
  const vals = [];
  let i = 1;
  if (patch.dow !== undefined) {
    sets.push(`${COL.horarios.dow}=$${i++}`);
    vals.push(next.dow);
  }
  if (patch.hora_inicio !== undefined) {
    sets.push(`${COL.horarios.inicio}=$${i++}`);
    vals.push(next.hora_inicio);
  }
  if (patch.hora_fin !== undefined) {
    sets.push(`${COL.horarios.fin}=$${i++}`);
    vals.push(next.hora_fin);
  }
  if (patch.capacidad_maxima !== undefined) {
    sets.push(`${COL.horarios.capacidad}=$${i++}`);
    vals.push(patch.capacidad_maxima);
  }
  if (!sets.length) return { id: slotId };

  vals.push(labId, slotId);

  const { rowCount } = await pool.query(
    `UPDATE ${TB.horarios}
        SET ${sets.join(", ")}
      WHERE ${COL.horarios.labId}=$${i++} AND ${COL.horarios.id}=$${i}
      RETURNING ${COL.horarios.id}`,
    vals
  );
  if (!rowCount) return null;

  await logHistorySafe(
    labId,
    "actualizacion_lab",
    { tipo: "horario", op: "actualizado", id: slotId, patch },
    actorId
  );
  return { id: slotId };
}

// Eliminar franja
export async function deleteHorario(labId, slotId, actorId) {
  await assertLabExists(labId);
  const { rowCount } = await pool.query(
    `DELETE FROM ${TB.horarios}
     WHERE ${COL.horarios.labId}=$1 AND ${COL.horarios.id}=$2`,
    [labId, slotId]
  );
  if (rowCount) {
    await logHistorySafe(
      labId,
      "actualizacion_lab",
      { tipo: "horario", op: "eliminado", id: slotId },
      actorId
    );
  }
  return !!rowCount;
}
