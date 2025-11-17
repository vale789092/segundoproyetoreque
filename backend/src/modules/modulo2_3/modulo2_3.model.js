// backend/src/modules/modulo2_3/modulo2_3.model.js
import { pool } from "../../db/index.js";

/** ======= Constantes / helpers ======= */
const TB = {
  users: "users",
  labs: "laboratorios",
  equipos: "equipos_fijos",
  mant: "mantenimientos",
  mrec: "mantenimiento_recursos",
  hmant: "historial_mantenimientos",
};

const COL = {
  users: { id: "id", rol: "rol", activo: "activo" },
  equipos: {
    id: "id",
    labId: "laboratorio_id",
    nombre: "nombre",
    estadoDisp: "estado_disp",
    updated: "updated_at",
  },
  mant: {
    id: "id",
    programado: "programado_para",
    tipo: "tipo",
    tecnico: "tecnico_id",
    proc: "procedimientos",
    rep: "repuestos_usados",
    obs: "observaciones",
    creado: "creado_en",
    upd: "actualizado_en",
  },
  mrec: { id: "id", mantId: "mantenimiento_id", equipoId: "equipo_id" },
  hmant: {
    id: "id",
    mantId: "mantenimiento_id",
    equipoId: "equipo_id",
    labId: "laboratorio_id",
    userId: "usuario_id",
    accion: "accion",
    detalle: "detalle",
    creado: "creado_en",
  },
};

const ALLOWED_TIPO = new Set([
  "preventivo",
  "correctivo",
  "calibracion",
  "inspeccion",
  "otro",
]);

async function assertUserIsTechOrAdmin(userId) {
  const q = `SELECT ${COL.users.rol} AS rol, ${COL.users.activo} AS activo FROM ${TB.users} WHERE ${COL.users.id}=$1`;
  const { rows, rowCount } = await pool.query(q, [userId]);
  if (!rowCount) {
    const e = new Error("Usuario inexistente"); e.code = "23503"; throw e;
  }
  const { rol, activo } = rows[0];
  if ((rol === "tecnico" || rol === "admin") && activo === true) return true;
  const e = new Error("Solo 'tecnico' activo o 'admin' puede operar mantenimientos");
  e.code = "USR_NOT_TECH_OR_ADMIN"; throw e;
}

async function equiposByIds(ids = []) {
  if (!ids?.length) return [];
  const params = ids.map((_, i) => `$${i + 1}`).join(",");
  const sql = `SELECT ${COL.equipos.id} AS id, ${COL.equipos.labId} AS laboratorio_id, ${COL.equipos.nombre} AS nombre
               FROM ${TB.equipos} WHERE ${COL.equipos.id} IN (${params})`;
  const { rows } = await pool.query(sql, ids);
  return rows;
}

async function logMant({ mantenimiento_id, equipo_id = null, laboratorio_id = null, usuario_id = null, accion, detalle = null }) {
  try {
    await pool.query(
      `INSERT INTO ${TB.hmant}
        (${COL.hmant.mantId}, ${COL.hmant.equipoId}, ${COL.hmant.labId}, ${COL.hmant.userId}, ${COL.hmant.accion}, ${COL.hmant.detalle})
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [mantenimiento_id, equipo_id, laboratorio_id, usuario_id, accion, detalle ? JSON.stringify(detalle) : null]
    );
  } catch (e) {
    console.error("[hmant] fail:", e.code || e.message);
  }
}

/** ===== Utilidades de estado de equipos ===== */
async function marcarEquiposEnMantenimiento(clientOrPool, equipoIds = []) {
  if (!equipoIds?.length) return;
  const placeholders = equipoIds.map((_, i) => `$${i + 1}`).join(",");
  const sql = `
    UPDATE ${TB.equipos}
       SET ${COL.equipos.estadoDisp}='en_mantenimiento',
           ${COL.equipos.updated}=now()
     WHERE ${COL.equipos.id} IN (${placeholders})
  `;
  await clientOrPool.query(sql, equipoIds);
}

async function intentarMarcarEquipoDisponibleSiLibre(clientOrPool, equipoId) {
  // ¿sigue asociado a algún mantenimiento?
  const { rowCount } = await clientOrPool.query(
    `SELECT 1 FROM ${TB.mrec} WHERE ${COL.mrec.equipoId}=$1 LIMIT 1`,
    [equipoId]
  );
  if (rowCount === 0) {
    await clientOrPool.query(
      `UPDATE ${TB.equipos}
          SET ${COL.equipos.estadoDisp}='disponible',
              ${COL.equipos.updated}=now()
        WHERE ${COL.equipos.id}=$1`,
      [equipoId]
    );
  }
}

/** ======= 2.3.1 Programación (crear) ======= */
export async function createMaintenance({
  programado_para,
  tipo,
  tecnico_id,
  procedimientos = null,
  repuestos_usados = null,
  observaciones = null,
  equipo_ids = [],        // opcional: recursos involucrados
}, actorId) {
  if (!programado_para || !tipo || !tecnico_id) {
    const e = new Error("programado_para, tipo y tecnico_id son requeridos");
    e.code = "22P02"; throw e;
  }
  if (!ALLOWED_TIPO.has(String(tipo))) {
    const e = new Error("tipo inválido (preventivo|correctivo|calibracion|inspeccion|otro)");
    e.code = "22P02"; throw e;
  }

  // valida rol del técnico
  await assertUserIsTechOrAdmin(tecnico_id);

  // Normaliza JSON opcional
  if (typeof repuestos_usados === "string") {
    try { repuestos_usados = JSON.parse(repuestos_usados); } catch { repuestos_usados = null; }
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const ins = await client.query(
      `INSERT INTO ${TB.mant}
        (${COL.mant.programado}, ${COL.mant.tipo}, ${COL.mant.tecnico}, ${COL.mant.proc}, ${COL.mant.rep}, ${COL.mant.obs})
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING ${COL.mant.id} AS id, ${COL.mant.programado} AS programado_para`,
      [programado_para, tipo, tecnico_id, procedimientos, repuestos_usados, observaciones]
    );
    const mantId = ins.rows[0].id;

    // Adjunta recursos si vienen
    let equipos = [];
    if (equipo_ids?.length) {
      // verifica que existan
      equipos = await equiposByIds(equipo_ids);
      if (equipos.length !== equipo_ids.length) {
        const e = new Error("Algún equipo_id no existe"); e.code = "23503"; throw e;
      }
      // inserta N:M
      for (const eqId of equipo_ids) {
        await client.query(
          `INSERT INTO ${TB.mrec} (${COL.mrec.mantId}, ${COL.mrec.equipoId})
           VALUES ($1,$2)
           ON CONFLICT DO NOTHING`,
          [mantId, eqId]
        );
      }
      // ► marcar estado de equipos: en_mantenimiento
      await marcarEquiposEnMantenimiento(client, equipo_ids);
    }

    await client.query("COMMIT");

    // Logs (fuera de tx por simplicidad)
    await logMant({
      mantenimiento_id: mantId,
      usuario_id: actorId,
      accion: "creado",
      detalle: { programado_para, tipo, tecnico_id }
    });
    await logMant({
      mantenimiento_id: mantId,
      usuario_id: actorId,
      accion: "programado",
      detalle: { programado_para }
    });
    for (const eq of equipos) {
      await logMant({
        mantenimiento_id: mantId,
        equipo_id: eq.id,
        laboratorio_id: eq.laboratorio_id,
        usuario_id: actorId,
        accion: "actualizado",
        detalle: { op: "add_equipo", equipo_id: eq.id, set_estado: "en_mantenimiento" }
      });
    }

    return { id: mantId, programado_para };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

/** ======= 2.3.2 Registro / edición ======= */
export async function updateMaintenance(mantId, patch = {}, actorId) {
  // Validaciones
  if (patch.tipo !== undefined && !ALLOWED_TIPO.has(String(patch.tipo))) {
    const e = new Error("tipo inválido"); e.code = "22P02"; throw e;
  }
  if (patch.tecnico_id !== undefined) {
    await assertUserIsTechOrAdmin(patch.tecnico_id);
  }
  if (typeof patch.repuestos_usados === "string") {
    try { patch.repuestos_usados = JSON.parse(patch.repuestos_usados); } catch {}
  }

  const map = {
    programado_para: COL.mant.programado,
    tipo: COL.mant.tipo,
    tecnico_id: COL.mant.tecnico,
    procedimientos: COL.mant.proc,
    repuestos_usados: COL.mant.rep,
    observaciones: COL.mant.obs,
  };

  const sets = [], vals = []; let i = 1;
  for (const k of Object.keys(map)) {
    if (Object.prototype.hasOwnProperty.call(patch, k)) {
      sets.push(`${map[k]}=$${i++}`); vals.push(patch[k]);
    }
  }
  if (!sets.length) return { id: mantId };
  sets.push(`${COL.mant.upd}=now()`);

  vals.push(mantId);
  const { rowCount } = await pool.query(
    `UPDATE ${TB.mant} SET ${sets.join(", ")} WHERE ${COL.mant.id}=$${i}`,
    vals
  );
  if (!rowCount) return null;

  await logMant({
    mantenimiento_id: mantId,
    usuario_id: actorId,
    accion: "actualizado",
    detalle: { patch }
  });
  return { id: mantId };
}

/** ======= Recursos N:M ======= */
export async function addResources(mantId, equipo_ids = [], actorId) {
  if (!equipo_ids?.length) return { added: 0 };

  // verifica que existan
  const equipos = await equiposByIds(equipo_ids);
  if (equipos.length !== equipo_ids.length) {
    const e = new Error("Algún equipo_id no existe"); e.code = "23503"; throw e;
  }

  // Inserta relación
  let added = 0;
  for (const eqId of equipo_ids) {
    const r = await pool.query(
      `INSERT INTO ${TB.mrec} (${COL.mrec.mantId}, ${COL.mrec.equipoId})
       VALUES ($1,$2) ON CONFLICT DO NOTHING`,
      [mantId, eqId]
    );
    if (r.rowCount) added++;
  }

  // ► marcar estado de equipos: en_mantenimiento
  await marcarEquiposEnMantenimiento(pool, equipo_ids);

  for (const eq of equipos) {
    await logMant({
      mantenimiento_id: mantId,
      equipo_id: eq.id,
      laboratorio_id: eq.laboratorio_id,
      usuario_id: actorId,
      accion: "actualizado",
      detalle: { op: "add_equipo", equipo_id: eq.id, set_estado: "en_mantenimiento" }
    });
  }
  return { added };
}

export async function removeResource(mantId, equipoId, actorId) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const del = await client.query(
      `DELETE FROM ${TB.mrec} WHERE ${COL.mrec.mantId}=$1 AND ${COL.mrec.equipoId}=$2`,
      [mantId, equipoId]
    );

    if (del.rowCount) {
      // ► si ya no está asociado a ningún mantenimiento, volver a 'disponible'
      await intentarMarcarEquipoDisponibleSiLibre(client, equipoId);

      await logMant({
        mantenimiento_id: mantId,
        equipo_id: equipoId,
        usuario_id: actorId,
        accion: "actualizado",
        detalle: { op: "remove_equipo", equipo_id: equipoId, set_estado_posible: "disponible_si_libre" }
      });
    }

    await client.query("COMMIT");
    return del.rowCount > 0;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

/** ======= Get / List ======= */
export async function getMaintenance(mantId) {
  const base = (await pool.query(
    `SELECT
       m.${COL.mant.id} AS id,
       m.${COL.mant.programado} AS programado_para,
       m.${COL.mant.tipo} AS tipo,
       m.${COL.mant.tecnico} AS tecnico_id,
       m.${COL.mant.proc} AS procedimientos,
       m.${COL.mant.rep}  AS repuestos_usados,
       m.${COL.mant.obs}  AS observaciones,
       m.${COL.mant.creado} AS creado_en,
       m.${COL.mant.upd}    AS actualizado_en
     FROM ${TB.mant} m
     WHERE m.${COL.mant.id}=$1`,
    [mantId]
  )).rows[0];
  if (!base) return null;

  const recursos = (await pool.query(
    `SELECT
       e.${COL.equipos.id} AS id,
       e.${COL.equipos.labId} AS laboratorio_id,
       e.${COL.equipos.nombre} AS nombre
     FROM ${TB.mrec} mr
     JOIN ${TB.equipos} e ON e.${COL.equipos.id} = mr.${COL.mrec.equipoId}
     WHERE mr.${COL.mrec.mantId}=$1
     ORDER BY e.${COL.equipos.nombre} ASC`,
    [mantId]
  )).rows;

  return { ...base, recursos };
}

export async function listMaintenances({
  equipo_id,
  laboratorio_id,
  tecnico_id,
  tipo,
  from, to,     // filtra por programado_para
  limit = 50,
  offset = 0,
}) {
  const where = ["1=1"];
  const params = [];
  let i = 1;

  if (equipo_id) {
    where.push(`EXISTS (SELECT 1 FROM ${TB.mrec} x WHERE x.${COL.mrec.mantId}=m.${COL.mant.id} AND x.${COL.mrec.equipoId}=$${i++})`);
    params.push(equipo_id);
  }
  if (laboratorio_id) {
    where.push(`EXISTS (
      SELECT 1
        FROM ${TB.mrec} x JOIN ${TB.equipos} e ON e.${COL.equipos.id}=x.${COL.mrec.equipoId}
       WHERE x.${COL.mrec.mantId}=m.${COL.mant.id} AND e.${COL.equipos.labId}=$${i++}
    )`);
    params.push(laboratorio_id);
  }
  if (tecnico_id) { where.push(`m.${COL.mant.tecnico}=$${i++}`); params.push(tecnico_id); }
  if (tipo)       { where.push(`m.${COL.mant.tipo}=$${i++}`);    params.push(tipo); }
  if (from)       { where.push(`m.${COL.mant.programado}>= $${i++}`); params.push(from); }
  if (to)         { where.push(`m.${COL.mant.programado}<  $${i++}`); params.push(to); }

  limit = Number(limit); offset = Number(offset);
  if (!Number.isInteger(limit) || limit <= 0 || limit > 100) limit = 50;
  if (!Number.isInteger(offset) || offset < 0) offset = 0;

  const sql = `
    SELECT DISTINCT
      m.${COL.mant.id} AS id,
      m.${COL.mant.programado} AS programado_para,
      m.${COL.mant.tipo} AS tipo,
      m.${COL.mant.tecnico} AS tecnico_id,
      m.${COL.mant.creado} AS creado_en,
      m.${COL.mant.upd}    AS actualizado_en,
      COALESCE(rc.cantidad, 0) AS recursos_count
    FROM ${TB.mant} m
    LEFT JOIN (
      SELECT ${COL.mrec.mantId} AS mid, COUNT(*) AS cantidad
      FROM ${TB.mrec} GROUP BY ${COL.mrec.mantId}
    ) rc ON rc.mid = m.${COL.mant.id}
    WHERE ${where.join(" AND ")}
    ORDER BY m.${COL.mant.programado} DESC, m.${COL.mant.id} DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
  const { rows } = await pool.query(sql, params);
  return rows;
}

/** ======= 2.3.4 Historial de mantenimiento ======= */
export async function listMaintenanceHistory({
  equipo_id,
  laboratorio_id,
  from,
  to,
  limit = 200,
  offset = 0,
}) {
  const where = ["1=1"];
  const params = []; let i = 1;

  if (equipo_id)      { where.push(`${COL.hmant.equipoId}=$${i++}`); params.push(equipo_id); }
  if (laboratorio_id) { where.push(`${COL.hmant.labId}=$${i++}`);    params.push(laboratorio_id); }
  if (from)           { where.push(`${COL.hmant.creado}>= $${i++}`); params.push(from); }
  if (to)             { where.push(`${COL.hmant.creado}<  $${i++}`); params.push(to); }

  limit = Number(limit);
  offset = Number(offset);
  if (!Number.isInteger(limit) || limit <= 0 || limit > 500) limit = 200;
  if (!Number.isInteger(offset) || offset < 0) offset = 0;

  const sql = `
    SELECT
      ${COL.hmant.id} AS id,
      ${COL.hmant.mantId} AS mantenimiento_id,
      ${COL.hmant.equipoId} AS equipo_id,
      ${COL.hmant.labId} AS laboratorio_id,
      ${COL.hmant.userId} AS usuario_id,
      ${COL.hmant.accion} AS accion,
      ${COL.hmant.detalle} AS detalle,
      ${COL.hmant.creado} AS creado_en
    FROM ${TB.hmant}
    WHERE ${where.join(" AND ")}
    ORDER BY ${COL.hmant.creado} DESC, ${COL.hmant.id} DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
  const { rows } = await pool.query(sql, params);
  return rows;
}
