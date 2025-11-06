import { pool } from "../../db/index.js";

/** Tablas/columnas según esquema */
const TB = {
  labs: "laboratorios",
  techLabs: "tecnicos_labs",
  users: "users",
  policies: "requisitos",
  history: "historial_laboratorio",
  equipos: "equipos_fijos",
};

const COL = {
  labs: { 
    id: "id"
    , nombre: "nombre"
    , codigo: "codigo_interno"
    , ubicacion: "ubicacion"
    , descripcion: "descripcion"
    , created: "created_at"  
    , updated: "updated_at"  
},
  techLabs: { 
    id: "id"
    , labId: "laboratorio_id"
    , userId: "usuario_id"
    , cargo: "cargo"
    , activo: "activo"
    , desde: "asignado_desde"
    , hasta: "asignado_hasta" 
},
  users: { 
    id: "id"
    , nombre: "nombre"
    , correo: "correo"
    , rol: "rol"
    , activo: "activo"
    , telefono: "telefono" 
},
  policies: { 
    id: "id"
    , labId: "laboratorio_id"
    , nombre: "nombre"
    , descripcion: "descripcion"
    , tipo: "tipo"
    , obligatorio: "obligatorio"
    , desde: "vigente_desde"
    , hasta: "vigente_hasta" },
  history: { 
    id: "id"
    , labId: "laboratorio_id"
    , userId: "usuario_id"
    , accion: "accion"
    , detalle: "detalle"
    , creado: "creado_en" },
  equipos: {
    id: "id",
    labId: "laboratorio_id",
    codigo: "codigo_inventario",
    nombre: "nombre",
    estadoOp: "estado_operativo",
    ultimoMant: "fecha_ultimo_mant",
    tipo: "tipo",
    estadoDisp: "estado_disp",
    cantTotal: "cantidad_total",
    cantDisp: "cantidad_disponible",
    ficha: "ficha_tecnica",
    fotos: "fotos",
    reservable: "reservable",
    created: "created_at",
    updated: "updated_at"
  }
};

/* ==================== LABS ==================== */
export async function createLab({ nombre, codigo_interno, ubicacion, descripcion = null }) {
  const { rows } = await pool.query(
    `INSERT INTO ${TB.labs}
       (${COL.labs.nombre}, ${COL.labs.codigo}, ${COL.labs.ubicacion}, ${COL.labs.descripcion})
     VALUES ($1,$2,$3,$4)
     RETURNING
       ${COL.labs.id}      AS id,
       ${COL.labs.created} AS created_at,
       ${COL.labs.updated} AS updated_at`,
    [nombre, codigo_interno, ubicacion, descripcion]
  );
  return rows[0]; 
}

export async function listLabs() {
  const { rows } = await pool.query(
    `SELECT ${COL.labs.id} AS id, ${COL.labs.nombre} AS nombre, ${COL.labs.codigo} AS codigo_interno,
            ${COL.labs.ubicacion} AS ubicacion, ${COL.labs.descripcion} AS descripcion
       FROM ${TB.labs}
      ORDER BY ${COL.labs.nombre} ASC`
  );
  return rows;
}

export async function getLab(labId) {
  const lab = (await pool.query(
    `SELECT
       ${COL.labs.id}        AS id,
       ${COL.labs.nombre}    AS nombre,
       ${COL.labs.codigo}    AS codigo_interno,
       ${COL.labs.ubicacion} AS ubicacion,
       ${COL.labs.descripcion} AS descripcion,
       ${COL.labs.created}   AS created_at,   
       ${COL.labs.updated}   AS updated_at     
     FROM ${TB.labs}
     WHERE ${COL.labs.id}=$1`,
    [labId]
  )).rows[0];
  if (!lab) return null;

  const [techs, policies] = await Promise.all([
    pool.query(
      `SELECT tl.${COL.techLabs.id} AS id,
              u.${COL.users.id} AS usuario_id,
              u.${COL.users.nombre} AS usuario_nombre,
              u.${COL.users.correo} AS usuario_correo,
              u.${COL.users.rol} AS usuario_rol,
              u.${COL.users.telefono} AS usuario_telefono,
              tl.${COL.techLabs.cargo} AS cargo,
              tl.${COL.techLabs.activo} AS activo,
              tl.${COL.techLabs.desde} AS asignado_desde,
              tl.${COL.techLabs.hasta} AS asignado_hasta
         FROM ${TB.techLabs} tl
         JOIN ${TB.users} u ON u.${COL.users.id} = tl.${COL.techLabs.userId}
        WHERE tl.${COL.techLabs.labId} = $1
        ORDER BY tl.${COL.techLabs.desde} DESC, tl.${COL.techLabs.id} ASC`,
      [labId]
    ),
    pool.query(
      `SELECT ${COL.policies.id} AS id,
              ${COL.policies.nombre} AS nombre,
              ${COL.policies.descripcion} AS descripcion,
              ${COL.policies.tipo} AS tipo,
              ${COL.policies.obligatorio} AS obligatorio,
              ${COL.policies.desde} AS vigente_desde,
              ${COL.policies.hasta} AS vigente_hasta
         FROM ${TB.policies}
        WHERE ${COL.policies.labId} = $1
        ORDER BY ${COL.policies.nombre} ASC, ${COL.policies.id} ASC`,
      [labId]
    ),
  ]);

  return { lab, technicians: techs.rows, policies: policies.rows };
}

export async function updateLab(labId, patch) {
  const sets = [];
  const vals = [];
  let i = 1;
  if (patch.nombre != null)      { sets.push(`${COL.labs.nombre}=$${i++}`);      vals.push(patch.nombre); }
  if (patch.codigo_interno != null){ sets.push(`${COL.labs.codigo}=$${i++}`);    vals.push(patch.codigo_interno); }
  if (patch.ubicacion != null)   { sets.push(`${COL.labs.ubicacion}=$${i++}`);   vals.push(patch.ubicacion); }
  if (patch.descripcion != null) { sets.push(`${COL.labs.descripcion}=$${i++}`); vals.push(patch.descripcion); }

  // marca actualización
  sets.push(`${COL.labs.updated}=now()`);

  const sql = `UPDATE ${TB.labs} SET ${sets.join(", ")} WHERE ${COL.labs.id}=$${i} RETURNING
                 ${COL.labs.id} AS id, ${COL.labs.created} AS created_at, ${COL.labs.updated} AS updated_at`;
  vals.push(labId);

  const { rows } = await pool.query(sql, vals);
  return rows[0] || null;
}

export async function deleteLab(labId, byUserId = null) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1) Verifica existencia
    const exists = await client.query(
      `SELECT 1 FROM ${TB.labs} WHERE ${COL.labs.id}=$1`,
      [labId]
    );
    if (exists.rowCount === 0) {
      const e = new Error("Laboratorio no encontrado");
      e.status = 404;
      throw e;
    }

    // 2) Historial ANTES del borrado (usa un valor permitido en 'accion')
    await client.query(
      `INSERT INTO ${TB.history}
         (${COL.history.labId}, ${COL.history.userId}, ${COL.history.accion}, ${COL.history.detalle})
       VALUES ($1, $2, 'actualizacion_lab', $3::jsonb)`,
      [labId, byUserId, JSON.stringify({ evento: "eliminacion_lab" })]
    );

    // 3) Borrar el laboratorio
    await client.query(
      `DELETE FROM ${TB.labs} WHERE ${COL.labs.id}=$1`,
      [labId]
    );

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}


/* ==================== TECNICOS_LABS ==================== */
export async function assertUserIsTechOrAdmin(userId) {
  const q = `
    SELECT ${COL.users.rol} AS rol, ${COL.users.activo} AS activo
    FROM ${TB.users}
    WHERE ${COL.users.id} = $1
  `;
  const { rows, rowCount } = await pool.query(q, [userId]);
  if (!rowCount) {
    const err = new Error("Usuario inexistente");
    err.code = "23503"; // referencia inválida
    throw err;
  }
  const { rol, activo } = rows[0];
  if (rol === "admin") return true;           // admin puede todo
  if (rol === "tecnico" && activo === true) return true; // técnico debe estar activo

  const err = new Error("Solo usuarios con rol 'tecnico' (activo) o 'admin' pueden ser responsables");
  err.code = "USR_NOT_TECH_OR_ADMIN";
  throw err;
}

export async function addTechnicianToLab(labId, { usuario_id, activo, asignado_hasta }) {
  const cargo = "tecnico"; // <- ignoramos lo que venga y forzamos técnico
  const { rows } = await pool.query(
    `INSERT INTO ${TB.techLabs}
      (${COL.techLabs.labId}, ${COL.techLabs.userId}, ${COL.techLabs.cargo},
       ${COL.techLabs.activo}, ${COL.techLabs.hasta})
     VALUES ($1,$2,$3,$4,$5)
     RETURNING ${COL.techLabs.id} AS id`,
    [labId, usuario_id, cargo, activo, asignado_hasta ?? null]
  );

  await pool.query(
    `INSERT INTO ${TB.history} (${COL.history.labId}, ${COL.history.accion}, ${COL.history.detalle})
     VALUES ($1, 'actualizacion_lab', $2)`,
    [labId, JSON.stringify({ tecnico_lab_id: rows[0].id, op: "asignado" })]
  );
  return { id: rows[0].id };
}

export async function listTechniciansOfLab(labId) {
  const { rows } = await pool.query(
    `SELECT tl.${COL.techLabs.id} AS id,
            u.${COL.users.id} AS usuario_id,
            u.${COL.users.nombre} AS usuario_nombre,
            u.${COL.users.correo} AS usuario_correo,
            u.${COL.users.rol} AS usuario_rol,
            u.${COL.users.telefono} AS usuario_telefono,
            tl.${COL.techLabs.cargo} AS cargo,
            tl.${COL.techLabs.activo} AS activo,
            tl.${COL.techLabs.desde} AS asignado_desde,
            tl.${COL.techLabs.hasta} AS asignado_hasta
       FROM ${TB.techLabs} tl
       JOIN ${TB.users} u ON u.${COL.users.id} = tl.${COL.techLabs.userId}
      WHERE tl.${COL.techLabs.labId}=$1
      ORDER BY tl.${COL.techLabs.desde} DESC, tl.${COL.techLabs.id} ASC`,
    [labId]
  );
  return rows;
}

export async function updateTechnicianAssignment(labId, tecLabId, { cargo, activo, asignado_hasta }) {
  const sets = [], vals = []; let i = 1;
  if (cargo !== undefined)         { sets.push(`${COL.techLabs.cargo}=$${i++}`); vals.push(cargo); }
  if (activo !== undefined)        { sets.push(`${COL.techLabs.activo}=$${i++}`); vals.push(!!activo); }
  if (asignado_hasta !== undefined){ sets.push(`${COL.techLabs.hasta}=$${i++}`); vals.push(asignado_hasta); }
  if (!sets.length) return { id: tecLabId };

  vals.push(labId, tecLabId);
  const { rowCount } = await pool.query(
    `UPDATE ${TB.techLabs} SET ${sets.join(", ")}
      WHERE ${COL.techLabs.labId}=$${i++} AND ${COL.techLabs.id}=$${i}
      RETURNING ${COL.techLabs.id}`,
    vals
  );

  if (rowCount === 0) {
    const e = new Error("Asignación no encontrada");
    e.status = 404;
    throw e;
  }

  await pool.query(
    `INSERT INTO ${TB.history} (${COL.history.labId}, ${COL.history.accion}, ${COL.history.detalle})
     VALUES ($1, 'actualizacion_lab', $2)`,
    [labId, JSON.stringify({ tecnico_lab_id: tecLabId, op: "actualizado", /* fields opcional */ })]
  );
  return { id: tecLabId };
}


export async function removeTechnicianFromLab(labId, tecLabId) {
  const { rows, rowCount } = await pool.query(
    `DELETE FROM ${TB.techLabs}
      WHERE ${COL.techLabs.id}=$1 AND ${COL.techLabs.labId}=$2
      RETURNING ${COL.techLabs.id}`,
    [tecLabId, labId]
  );

  if (rowCount === 0) {
    const e = new Error("Asignación no encontrada");
    e.status = 404;
    throw e;
  }

  await pool.query(
    `INSERT INTO ${TB.history} (${COL.history.labId}, ${COL.history.accion}, ${COL.history.detalle})
     VALUES ($1, 'actualizacion_lab', $2)`,
    [labId, JSON.stringify({ tecnico_lab_id: rows[0].id, op: "removido" })]
  );
}


/* ==================== REQUISITOS (POLÍTICAS) ==================== */
export async function createPolicy(labId, { nombre, descripcion, tipo, obligatorio, vigente_desde, vigente_hasta }) {
  const { rows } = await pool.query(
    `INSERT INTO ${TB.policies}
      (${COL.policies.labId}, ${COL.policies.nombre}, ${COL.policies.descripcion}, ${COL.policies.tipo}, ${COL.policies.obligatorio}, ${COL.policies.desde}, ${COL.policies.hasta})
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING ${COL.policies.id} AS id`,
    [labId, nombre, descripcion, tipo, !!obligatorio, vigente_desde ?? null, vigente_hasta ?? null]
  );
  await pool.query(
    `INSERT INTO ${TB.history} (${COL.history.labId}, ${COL.history.accion}, ${COL.history.detalle})
     VALUES ($1, 'politica_creada', $2)`,
    [labId, JSON.stringify({ policy_id: rows[0].id })]
  );
  return { id: rows[0].id };
}

export async function listPolicies(labId) {
  const { rows } = await pool.query(
    `SELECT ${COL.policies.id} AS id, ${COL.policies.nombre} AS nombre, ${COL.policies.descripcion} AS descripcion,
            ${COL.policies.tipo} AS tipo, ${COL.policies.obligatorio} AS obligatorio,
            ${COL.policies.desde} AS vigente_desde, ${COL.policies.hasta} AS vigente_hasta
       FROM ${TB.policies}
      WHERE ${COL.policies.labId}=$1
      ORDER BY ${COL.policies.nombre} ASC, ${COL.policies.id} ASC`,
    [labId]
  );
  return rows;
}

export async function updatePolicy(labId, policyId, patch) {
  const { nombre, descripcion, tipo, obligatorio, vigente_desde, vigente_hasta } = patch || {};
  const sets = [], vals = []; let i = 1;
  if (nombre !== undefined)         { sets.push(`${COL.policies.nombre}=$${i++}`); vals.push(nombre); }
  if (descripcion !== undefined)    { sets.push(`${COL.policies.descripcion}=$${i++}`); vals.push(descripcion); }
  if (tipo !== undefined)           { sets.push(`${COL.policies.tipo}=$${i++}`); vals.push(tipo); }
  if (obligatorio !== undefined)    { sets.push(`${COL.policies.obligatorio}=$${i++}`); vals.push(!!obligatorio); }
  if (vigente_desde !== undefined)  { sets.push(`${COL.policies.desde}=$${i++}`); vals.push(vigente_desde); }
  if (vigente_hasta !== undefined)  { sets.push(`${COL.policies.hasta}=$${i++}`); vals.push(vigente_hasta); }
  if (!sets.length) return { id: policyId };

  vals.push(labId, policyId);
  const { rowCount } = await pool.query(
    `UPDATE ${TB.policies} SET ${sets.join(", ")}
      WHERE ${COL.policies.labId}=$${i++} AND ${COL.policies.id}=$${i}
      RETURNING ${COL.policies.id}`,
    vals
  );
  if (rowCount === 0) {
    const e = new Error("Política no encontrada");
    e.status = 404; throw e;
  }

  await pool.query(
    `INSERT INTO ${TB.history} (${COL.history.labId}, ${COL.history.accion}, ${COL.history.detalle})
     VALUES ($1, 'politica_actualizada', $2)`,
    [labId, JSON.stringify({ policy_id: policyId, fields: sets.map(s => s.split("=")[0]) })]
  );
  return { id: policyId };
}


export async function deletePolicy(labId, policyId) {
  const { rowCount } = await pool.query(
    `DELETE FROM ${TB.policies}
      WHERE ${COL.policies.id}=$1 AND ${COL.policies.labId}=$2
      RETURNING ${COL.policies.id}`,
    [policyId, labId]
  );
  if (rowCount === 0) {
    const e = new Error("Política no encontrada");
    e.status = 404; throw e;
  }
  await pool.query(
    `INSERT INTO ${TB.history} (${COL.history.labId}, ${COL.history.accion}, ${COL.history.detalle})
     VALUES ($1, 'politica_actualizada', $2)`,
    [labId, JSON.stringify({ policy_id: policyId, op: "deleted" })]
  );
}


/* ==================== HISTORIAL ==================== */
export async function listHistory(
  labId,
  { accion, desde, hasta, equipo_id, tipo, q, limit = 50, offset = 0 } = {}
) {
  // saneo de límites
  limit = Number(limit);
  offset = Number(offset);
  if (!Number.isInteger(limit) || limit <= 0 || limit > 100) limit = 50;
  if (!Number.isInteger(offset) || offset < 0) offset = 0;

  const where = [`h.${COL.history.labId} = $1`];
  const params = [labId];
  let i = 2;

  if (accion) {
    if (Array.isArray(accion)) {
      where.push(`h.${COL.history.accion} = ANY($${i})`);
      params.push(accion);
      i++;
    } else {
      where.push(`h.${COL.history.accion} = $${i}`);
      params.push(String(accion));
      i++;
    }
  }
  if (desde) { where.push(`h.${COL.history.creado} >= $${i}`); params.push(desde); i++; }
  if (hasta) { where.push(`h.${COL.history.creado} <  $${i}`); params.push(hasta); i++; }
  if (equipo_id) {
    where.push(`(h.${COL.history.detalle}->>'equipo_id') = $${i}`);
    params.push(String(equipo_id)); i++;
  }
  if (tipo) {
    // p.ej.: { tipo: "horario" } cuando registras cambios de 1.2.1
    where.push(`(h.${COL.history.detalle}->>'tipo') = $${i}`);
    params.push(String(tipo)); i++;
  }
  if (q) {
    where.push(`h.${COL.history.detalle}::text ILIKE $${i}`);
    params.push(`%${q}%`); i++;
  }

  const sql = `
    SELECT
      h.${COL.history.id}     AS id,
      h.${COL.history.userId} AS usuario_id,
      u.${COL.users.nombre}   AS usuario_nombre,
      u.${COL.users.correo}   AS usuario_correo,
      h.${COL.history.accion} AS accion,
      h.${COL.history.detalle} AS detalle,
      h.${COL.history.creado} AS creado_en
    FROM ${TB.history} h
    LEFT JOIN ${TB.users} u ON u.${COL.users.id} = h.${COL.history.userId}
    WHERE ${where.join(" AND ")}
    ORDER BY h.${COL.history.creado} DESC, h.${COL.history.id} DESC
    LIMIT $${i} OFFSET $${i + 1}
  `;
  params.push(limit, offset);

  const { rows } = await pool.query(sql, params);
  return rows;
}

/* --------------------------------------- */
/* 1.1.3 Equipos fijos (recursos)          */
/* --------------------------------------- */

export async function assertLabExists(labId) {
  const { rowCount } = await pool.query(
    `SELECT 1 FROM ${TB.labs} WHERE ${COL.labs.id}=$1`, [labId]
  );
  if (!rowCount) {
    const err = new Error("Laboratorio no existe"); err.code = "23503"; throw err;
  }
}

const ALLOWED_ESTADO_OP = new Set(["operativo","fuera_servicio","baja"]);
const ALLOWED_TIPO      = new Set(["equipo","material","software"]);
const ALLOWED_EDISP     = new Set(["disponible","reservado","en_mantenimiento","inactivo"]);

export async function createEquipo(labId, payload = {}, actorId = null) {
  let {
    codigo_inventario,
    nombre,
    estado_operativo,
    fecha_ultimo_mantenimiento = null,

    tipo = "equipo",
    estado_disp = "inactivo",
    cantidad_total = 1,
    cantidad_disponible = null,
    ficha_tecnica = null,
    fotos = null,
    reservable = true,
  } = payload;

  if (!codigo_inventario || !nombre || !estado_operativo) {
    const e = new Error("codigo_inventario, nombre y estado_operativo son requeridos");
    e.code = "22P02";
    throw e;
  }
  if (!ALLOWED_ESTADO_OP.has(String(estado_operativo))) { const e = new Error("estado_operativo inválido"); e.code="22P02"; throw e; }
  if (tipo && !ALLOWED_TIPO.has(String(tipo)))          { const e = new Error("tipo inválido");             e.code="22P02"; throw e; }
  if (estado_disp && !ALLOWED_EDISP.has(String(estado_disp))) { const e = new Error("estado_disp inválido"); e.code="22P02"; throw e; }

  if (cantidad_disponible == null) cantidad_disponible = cantidad_total;

  if (typeof ficha_tecnica === "string") { try { ficha_tecnica = JSON.parse(ficha_tecnica); } catch { ficha_tecnica = null; } }
  if (typeof fotos === "string")         { try { fotos = JSON.parse(fotos); }               catch { fotos = null; } }

  const { rows } = await pool.query(
    `INSERT INTO ${TB.equipos}
      (${COL.equipos.labId}, ${COL.equipos.codigo}, ${COL.equipos.nombre},
       ${COL.equipos.estadoOp}, ${COL.equipos.ultimoMant},
       ${COL.equipos.tipo}, ${COL.equipos.estadoDisp},
       ${COL.equipos.cantTotal}, ${COL.equipos.cantDisp},
       ${COL.equipos.ficha}, ${COL.equipos.fotos}, ${COL.equipos.reservable})
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     RETURNING ${COL.equipos.id} AS id,
               ${COL.equipos.created} AS created_at,
               ${COL.equipos.updated} AS updated_at`,
    [
      labId,
      codigo_inventario,
      nombre,
      estado_operativo,
      fecha_ultimo_mantenimiento,
      tipo,
      estado_disp,
      cantidad_total,
      cantidad_disponible,
      ficha_tecnica,
      fotos,
      reservable,
    ]
  );
  const nuevoId = rows[0].id;

  // Bitácora: alta_equipo con usuario_id
  await pool.query(
    `INSERT INTO ${TB.history} (${COL.history.labId}, ${COL.history.userId}, ${COL.history.accion}, ${COL.history.detalle})
     VALUES ($1,$2,'alta_equipo',$3)`,
    [labId, actorId, JSON.stringify({ equipo_id: nuevoId, codigo_inventario })]
  );

  return rows[0];
}

export async function listEquipos(labId, { tipo, estado_disp, reservable } = {}) {
  const where = [`${COL.equipos.labId}=$1`];
  const params = [labId];
  let i = 2;

  if (tipo)        { where.push(`${COL.equipos.tipo}=$${i++}`);        params.push(tipo); }
  if (estado_disp) { where.push(`${COL.equipos.estadoDisp}=$${i++}`);  params.push(estado_disp); }
  if (reservable !== undefined) { where.push(`${COL.equipos.reservable}=$${i++}`); params.push(!!reservable); }

  const sql = `
    SELECT
      ${COL.equipos.id}         AS id,
      ${COL.equipos.codigo}     AS codigo_inventario,
      ${COL.equipos.nombre}     AS nombre,
      ${COL.equipos.estadoOp}   AS estado_operativo,
      ${COL.equipos.ultimoMant} AS fecha_ultimo_mantenimiento,
      ${COL.equipos.tipo}       AS tipo,
      ${COL.equipos.estadoDisp} AS estado_disp,
      ${COL.equipos.cantTotal}  AS cantidad_total,
      ${COL.equipos.cantDisp}   AS cantidad_disponible,
      ${COL.equipos.ficha}      AS ficha_tecnica,
      ${COL.equipos.fotos}      AS fotos,
      ${COL.equipos.reservable} AS reservable,
      ${COL.equipos.created}    AS created_at,
      ${COL.equipos.updated}    AS updated_at
    FROM ${TB.equipos}
    WHERE ${where.join(" AND ")}
    ORDER BY ${COL.equipos.created} DESC, ${COL.equipos.id} ASC
  `;

  const { rows } = await pool.query(sql, params);
  return rows;
}


export async function getEquipo(labId, equipoId) {
  const { rows } = await pool.query(
    `SELECT
       ${COL.equipos.id}         AS id,
       ${COL.equipos.codigo}     AS codigo_inventario,
       ${COL.equipos.nombre}     AS nombre,
       ${COL.equipos.estadoOp}   AS estado_operativo,
       ${COL.equipos.ultimoMant} AS fecha_ultimo_mantenimiento,
       ${COL.equipos.tipo}       AS tipo,
       ${COL.equipos.estadoDisp} AS estado_disp,
       ${COL.equipos.cantTotal}  AS cantidad_total,
       ${COL.equipos.cantDisp}   AS cantidad_disponible,
       ${COL.equipos.ficha}      AS ficha_tecnica,
       ${COL.equipos.fotos}      AS fotos,
       ${COL.equipos.reservable} AS reservable,
       ${COL.equipos.created}    AS created_at,
       ${COL.equipos.updated}    AS updated_at
     FROM ${TB.equipos}
    WHERE ${COL.equipos.labId}=$1 AND ${COL.equipos.id}=$2`,
    [labId, equipoId]
  );
  return rows[0] || null;
}

export async function updateEquipo(labId, equipoId, patch = {}, actorId = null) {
  const sets = [];
  const vals = [];
  let i = 1;

  if (Object.prototype.hasOwnProperty.call(patch, "estado_operativo")) {
    if (!ALLOWED_ESTADO_OP.has(String(patch.estado_operativo))) { const e = new Error("estado_operativo inválido"); e.code="22P02"; throw e; }
  }
  if (Object.prototype.hasOwnProperty.call(patch, "tipo")) {
    if (!ALLOWED_TIPO.has(String(patch.tipo))) { const e = new Error("tipo inválido"); e.code="22P02"; throw e; }
  }
  if (Object.prototype.hasOwnProperty.call(patch, "estado_disp")) {
    if (!ALLOWED_EDISP.has(String(patch.estado_disp))) { const e = new Error("estado_disp inválido"); e.code="22P02"; throw e; }
  }

  if (typeof patch.ficha_tecnica === "string") { try { patch.ficha_tecnica = JSON.parse(patch.ficha_tecnica); } catch {} }
  if (typeof patch.fotos === "string")         { try { patch.fotos = JSON.parse(patch.fotos); }               catch {} }

  const map = {
    codigo_inventario: COL.equipos.codigo,
    nombre: COL.equipos.nombre,
    estado_operativo: COL.equipos.estadoOp,
    fecha_ultimo_mantenimiento: COL.equipos.ultimoMant,
    tipo: COL.equipos.tipo,
    estado_disp: COL.equipos.estadoDisp,
    cantidad_total: COL.equipos.cantTotal,
    cantidad_disponible: COL.equipos.cantDisp,
    ficha_tecnica: COL.equipos.ficha,
    fotos: COL.equipos.fotos,
    reservable: COL.equipos.reservable,
  };

  for (const k of Object.keys(map)) {
    if (Object.prototype.hasOwnProperty.call(patch, k)) {
      sets.push(`${map[k]}=$${i++}`);
      vals.push(patch[k]);
    }
  }

  if (!sets.length) { const e = new Error("Nada que actualizar"); e.code = "22P02"; throw e; }
  sets.push(`${COL.equipos.updated}=now()`);

  const sql = `UPDATE ${TB.equipos}
                  SET ${sets.join(", ")}
                WHERE ${COL.equipos.labId}=$${i} AND ${COL.equipos.id}=$${i + 1}
                RETURNING ${COL.equipos.id} AS id,
                          ${COL.equipos.created} AS created_at,
                          ${COL.equipos.updated} AS updated_at`;
  vals.push(labId, equipoId);

  const { rows } = await pool.query(sql, vals);
  if (!rows[0]) return null;

  // Bitácora: si toca estado -> 'cambio_estado_equipo', si no -> 'actualizacion_equipo'
  const tocaEstado = Object.prototype.hasOwnProperty.call(patch, "estado_operativo")
                  || Object.prototype.hasOwnProperty.call(patch, "estado_disp");
  const accion = tocaEstado ? "cambio_estado_equipo" : "actualizacion_equipo";

  await pool.query(
    `INSERT INTO ${TB.history} (${COL.history.labId}, ${COL.history.userId}, ${COL.history.accion}, ${COL.history.detalle})
     VALUES ($1,$2,$3,$4)`,
    [labId, actorId, accion, JSON.stringify({ equipo_id: equipoId, patch })]
  );

  return rows[0];
}

export async function deleteEquipo(labId, equipoId, actorId = null) {
  const { rowCount } = await pool.query(
    `DELETE FROM ${TB.equipos}
      WHERE ${COL.equipos.labId}=$1 AND ${COL.equipos.id}=$2`,
    [labId, equipoId]
  );

  if (rowCount) {
    await pool.query(
      `INSERT INTO ${TB.history} (${COL.history.labId}, ${COL.history.userId}, ${COL.history.accion}, ${COL.history.detalle})
       VALUES ($1,$2,'actualizacion_equipo',$3)`,
      [labId, actorId, JSON.stringify({ equipo_id: equipoId, op: "eliminado" })]
    );
  }
  return !!rowCount;
}

// Lista de labs donde el técnico está asignado (activo)
export async function listLabsByTechnician(userId) {
  const { rows } = await pool.query(
    `SELECT l.${COL.labs.id} AS id,
            l.${COL.labs.nombre} AS nombre,
            l.${COL.labs.codigo} AS codigo_interno,
            l.${COL.labs.ubicacion} AS ubicacion,
            l.${COL.labs.descripcion} AS descripcion
       FROM ${TB.labs} l
       JOIN ${TB.techLabs} tl
         ON tl.${COL.techLabs.labId} = l.${COL.labs.id}
      WHERE tl.${COL.techLabs.userId} = $1
        AND COALESCE(tl.${COL.techLabs.activo}, true) = true
      ORDER BY l.${COL.labs.nombre} ASC`,
    [userId]
  );
  return rows;
}

// ¿Este usuario técnico está asignado al lab?
export async function isTechnicianOfLab(userId, labId) {
  const { rowCount } = await pool.query(
    `SELECT 1
       FROM ${TB.techLabs}
      WHERE ${COL.techLabs.userId} = $1
        AND ${COL.techLabs.labId} = $2
        AND COALESCE(${COL.techLabs.activo}, true) = true
      LIMIT 1`,
    [userId, labId]
  );
  return rowCount > 0;
}