import * as M from "./modulo1_1.model.js";

const bad = (res, msg) => res.status(400).json({ error: msg });
const deny = (res, msg = "No autorizado") => res.status(403).json({ error: msg });

function mapPg(e, res, next) {
  if (!e?.code) return next(e);
  const m = {
    "23505": [409, "Recurso duplicado"],
    "23503": [400, "Referencia inválida"],
    "23514": [400, "Violación de regla de datos"],
    "22P02": [400, "Dato inválido"],
    "USR_NOT_TECH_OR_ADMIN": [400, "Solo usuarios con rol 'tecnico' (activo) o 'admin' pueden ser responsables"],
  };
  const r = m[e.code];
  return r ? res.status(r[0]).json({ error: r[1], detail: e.detail || e.constraint || e.message }) : next(e);
}

/** ============= LABORATORIOS CRUD ============= */
export async function createLab(req, res, next) {
  try {
    const { nombre, codigo_interno, ubicacion, descripcion = null } = req.body || {};
    if (!nombre || !codigo_interno || !ubicacion) {
      return bad(res, "nombre, codigo_interno y ubicacion son requeridos");
    }
    const out = await M.createLab({ nombre, codigo_interno, ubicacion, descripcion });
    // out = { id, created_at, updated_at }
    return res.status(201).json(out);
  } catch (e) {
    return mapPg(e, res, next);
  }
}


export async function listLabs(req, res, next) {
  try {
    // Si viene ?mine=1 y el usuario es técnico, devuelve SOLO sus labs
    const mine = String(req.query?.mine || "") === "1";
    if (mine && req.user?.rol === "tecnico" && req.user?.id) {
      const list = await M.listLabsByTechnician(req.user.id);
      return res.status(200).json(list);
    }
    // default: todos
    const list = await M.listLabs();
    return res.status(200).json(list);
  } catch (e) {
    return mapPg(e, res, next);
  }
}

export async function getLab(req, res, next) {
  try {
    const labId = String(req.params.labId);
    const detail = await M.getLab(labId);
    if (!detail) return res.status(404).json({ error: "Laboratorio no encontrado" });
    return res.status(200).json(detail);
  } catch (e) {
    return mapPg(e, res, next);
  }
}

export async function updateLab(req, res, next) {
  try {
    const labId = String(req.params.labId);

    // Si es técnico, sólo puede editar labs donde esté asignado y activo
    if (req.user?.rol === "tecnico") {
      const ok = await M.isTechnicianOfLab(req.user.id, labId);
      if (!ok) return deny(res, "No autorizado para editar este laboratorio");
    }

    const patch = pick(req.body, ["nombre", "codigo_interno", "ubicacion", "descripcion"]);
    if (Object.keys(patch).length === 0) return bad(res, "Nada que actualizar");

    const updated = await M.updateLab(labId, patch);
    if (!updated) return res.status(404).json({ error: "Laboratorio no encontrado" });

    const detail = await M.getLab(labId);
    return res.status(200).json(detail);
  } catch (e) {
    return mapPg(e, res, next);
  }
}

function pick(src = {}, allowed = []) {
  const out = {};
  for (const k of allowed) if (Object.prototype.hasOwnProperty.call(src, k)) out[k] = src[k];
  return out;
}

export async function deleteLab(req, res, next) {
  try {
    const labId = String(req.params.labId);
    await M.deleteLab(labId, req.user?.id || null);
    return res.json({ ok: true });
  } catch (e) {
    return mapPg(e, res, next);
  }
}

/** ============= TECNICOS_LABS CRUD ============= */
export async function addTechnicianToLab(req, res, next) {
  try {
    const labId = String(req.params.labId);
    const { usuario_id, activo = true, asignado_hasta = null } = req.body || {};
    if (!usuario_id) return bad(res, "usuario_id requerido");
    await M.assertUserIsTechOrAdmin(usuario_id);

    const out = await M.addTechnicianToLab(labId, {
      usuario_id,
      activo: !!activo,
      asignado_hasta
    });
    return res.status(201).json(out);
  } catch (e) { return mapPg(e, res, next); }
}

export async function listTechniciansOfLab(req, res, next) {
  try {
    const labId = String(req.params.labId);
    return res.json(await M.listTechniciansOfLab(labId));
  } catch (e) { return next(e); }
}

export async function updateTechnicianAssignment(req, res, next) {
  try {
    const labId = String(req.params.labId);
    const tecLabId = String(req.params.tecLabId);
    const { cargo, activo, asignado_hasta } = req.body || {};
    const out = await M.updateTechnicianAssignment(labId, tecLabId, { cargo, activo, asignado_hasta });
    return res.json(out); // { id }
  } catch (e) { return mapPg(e, res, next); }
}

export async function removeTechnicianFromLab(req, res, next) {
  try {
    const labId = String(req.params.labId);
    const tecLabId = String(req.params.tecLabId);
    await M.removeTechnicianFromLab(labId, tecLabId);
    return res.json({ ok: true });
  } catch (e) { return mapPg(e, res, next); }
}

/** ============= REQUISITOS (POLÍTICAS) CRUD ============= */
const TIPOS = new Set(["academico","seguridad","otro"]);
 
export async function createPolicy(req, res, next) {
  try {
    const labId = String(req.params.labId);
    let { nombre, descripcion = null, tipo = "otro", obligatorio = true, vigente_desde = null, vigente_hasta = null } = req.body || {};
    if (!nombre) return bad(res, "nombre requerido");
    if (!TIPOS.has(String(tipo))) return bad(res, "tipo inválido (academico|seguridad|otro)");
    const out = await M.createPolicy(labId, { nombre, descripcion, tipo, obligatorio, vigente_desde, vigente_hasta });
    return res.status(201).json(out);
  } catch (e) { return mapPg(e, res, next); }
}


export async function listPolicies(req, res, next) {
  try {
    const labId = String(req.params.labId);
    return res.json(await M.listPolicies(labId));
  } catch (e) { return next(e); }
}

export async function updatePolicy(req, res, next) {
  try {
    const labId = String(req.params.labId);
    const policyId = String(req.params.policyId);
    const { nombre, descripcion, tipo, obligatorio, vigente_desde, vigente_hasta } = req.body || {};
    if (tipo !== undefined && !TIPOS.has(String(tipo))) return bad(res, "tipo inválido (academico|seguridad|otro)");
    const out = await M.updatePolicy(labId, policyId, { nombre, descripcion, tipo, obligatorio, vigente_desde, vigente_hasta });
    return res.json(out);
  } catch (e) { return mapPg(e, res, next); }
}

export async function deletePolicy(req, res, next) {
  try {
    const labId = String(req.params.labId);
    const policyId = String(req.params.policyId);
    await M.deletePolicy(labId, policyId);
    return res.json({ ok: true });
  } catch (e) { return mapPg(e, res, next); }
}

/** ============= BITÁCORA ============= */
export async function listHistory(req, res, next) {
  try {
    const labId = String(req.params.labId || "");
    const { accion, desde, hasta, equipo_id, tipo, q, limit, offset } = req.query || {};

    // soporta 'accion=a,b,c'
    const accionParam =
      typeof accion === "string" && accion.includes(",")
        ? accion.split(",").map(s => s.trim()).filter(Boolean)
        : accion;

    const out = await M.listHistory(labId, {
      accion: accionParam,
      desde,
      hasta,
      equipo_id,
      tipo,
      q,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
    return res.json(out);
  } catch (e) { next(e); }
}

/** ================ MODULO 1.1.3 — EQUIPOS ======================== */
const UUID_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const isUuid = (v) => typeof v === "string" && UUID_RE.test(v);

/** Respuesta de error uniforme */
function send(res, code, message) {
  return res.status(code).json({ error: { code, message } });
}

/** Mapeo simple de errores*/
function sendError(res, e) {
  if (e?.status) return send(res, e.status, e.message);
  switch (e?.code) {
    case "23505": return send(res, 409, "Registro duplicado");
    case "23503": return send(res, 400, "Referencia inválida");
    case "23514":
    case "22P02": return send(res, 400, e.message || "Datos inválidos");
    default: return send(res, 500, e?.message || "Error interno del servidor");
  }
}

function getActorId(req) {
  return (
    req.user?.id ??
    req.user?.user?.id ??
    req.auth?.id ??
    req.auth?.user?.id ??
    null
  );
}

// POST /labs/:labId/equipos
export async function createEquipo(req, res) {
  try {
    const labId = String(req.params.labId || "");
    if (!isUuid(labId)) return send(res, 400, "labId inválido");
    const actorId = getActorId(req);
    const out = await M.createEquipo(labId, req.body || {}, actorId);
    return res.status(201).json(out);
  } catch (e) { return sendError(res, e); }
}

// GET /labs/:labId/equipos
export async function listEquipos(req, res) {
  try {
    const labId = String(req.params.labId || "");
    if (!isUuid(labId)) return send(res, 400, "labId inválido");

    const { tipo, estado_disp, reservable } = req.query || {};
    const filters = {
      tipo: tipo ?? undefined,
      estado_disp: estado_disp ?? undefined,
      reservable: reservable !== undefined ? reservable === "true" : undefined,
    };

    const list = await M.listEquipos(labId, filters);
    return res.status(200).json(list);
  } catch (e) { return sendError(res, e); }
}

// GET /labs/:labId/equipos/:equipoId
export async function getEquipo(req, res) {
  try {
    const labId = String(req.params.labId || "");
    const equipoId = String(req.params.equipoId || "");
    if (!isUuid(labId) || !isUuid(equipoId)) return send(res, 400, "ids inválidos");

    const row = await M.getEquipo(labId, equipoId);
    if (!row) return send(res, 404, "Equipo no encontrado");
    return res.status(200).json(row);
  } catch (e) {
    return sendError(res, e);
  }
}

// PATCH /labs/:labId/equipos/:equipoId
export async function updateEquipo(req, res) {
  try {
    const labId = String(req.params.labId || "");
    const equipoId = String(req.params.equipoId || "");
    if (!isUuid(labId) || !isUuid(equipoId)) return send(res, 400, "ids inválidos");

    const actorId = getActorId(req);
    const updated = await M.updateEquipo(labId, equipoId, req.body || {}, actorId);
    if (!updated) return send(res, 404, "Equipo no encontrado");

    const row = await M.getEquipo(labId, equipoId);
    return res.status(200).json(row);
  } catch (e) { return sendError(res, e); }
}

// DELETE /labs/:labId/equipos/:equipoId
export async function deleteEquipo(req, res) {
  try {
    const labId = String(req.params.labId || "");
    const equipoId = String(req.params.equipoId || "");
    if (!isUuid(labId) || !isUuid(equipoId)) return send(res, 400, "ids inválidos");

    const actorId = getActorId(req);
    const ok = await M.deleteEquipo(labId, equipoId, actorId);
    if (!ok) return send(res, 404, "Equipo no encontrado");
    return res.status(200).json({ ok: true });
  } catch (e) { return sendError(res, e); }
}

// debajo de "TECNICOS_LABS CRUD"
export async function listEligibleTechnicians(req, res, next) {
  try {
    // opcional: solo admin puede ver candidatos
    if (req.user?.rol !== 'admin') return deny(res);

    const list = await M.listEligibleTechnicians();
    return res.json(list);
  } catch (e) { return next(e); }
}
