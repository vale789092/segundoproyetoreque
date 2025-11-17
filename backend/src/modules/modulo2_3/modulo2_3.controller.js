// backend/src/modules/modulo2_3/modulo2_3.controller.js
import {
  createMaintenance,
  updateMaintenance,
  addResources,
  removeResource,
  getMaintenance,
  listMaintenances,
  listMaintenanceHistory,
} from "./modulo2_3.model.js";

/** ===== Helpers / errores ===== */
const UUID_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const isUuid = (v) => typeof v === "string" && UUID_RE.test(v);

const send = (res, code, message) => res.status(code).json({ error: { code, message } });

function sendError(res, e) {
  if (e?.status) return send(res, e.status, e.message);
  switch (e?.code) {
    case "23505": return send(res, 409, "Registro duplicado");
    case "23503": return send(res, 400, "Referencia inválida");
    case "23514":
    case "22P02": return send(res, 400, e.message || "Datos inválidos");
    case "USR_NOT_TECH_OR_ADMIN": return send(res, 403, e.message || "No autorizado");
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
function requireTechOrAdmin(req) {
  const rol = req.user?.rol;
  if (rol !== "tecnico" && rol !== "admin") {
    const e = new Error("No autorizado"); e.status = 403; throw e;
  }
}

/** ===== 2.3.1 Programación (POST /maintenances) ===== */
export async function createMaintenanceCtrl(req, res) {
  try {
    requireTechOrAdmin(req);
    const actorId = getActorId(req);
    const {
      programado_para,
      tipo,
      tecnico_id,
      procedimientos,
      repuestos_usados,
      observaciones,
      equipo_ids,
    } = req.body || {};

    const created = await createMaintenance({
      programado_para,
      tipo,
      tecnico_id,
      procedimientos,
      repuestos_usados,
      observaciones,
      equipo_ids: Array.isArray(equipo_ids) ? equipo_ids : [],
    }, actorId);

    return res.status(201).json(created); // { id, programado_para }
  } catch (e) {
    return sendError(res, e);
  }
}

/** ===== 2.3.2 Registro / edición (PATCH /maintenances/:id) ===== */
export async function updateMaintenanceCtrl(req, res) {
  try {
    requireTechOrAdmin(req);
    const mantId = String(req.params.id || "");
    if (!isUuid(mantId)) return send(res, 400, "id inválido");
    const actorId = getActorId(req);

    const out = await updateMaintenance(mantId, req.body || {}, actorId);
    if (!out) return send(res, 404, "Mantenimiento no encontrado");

    const detail = await getMaintenance(mantId);
    return res.status(200).json(detail);
  } catch (e) { return sendError(res, e); }
}

/** ===== Recursos (POST/DELETE) ===== */
export async function addResourcesCtrl(req, res) {
  try {
    requireTechOrAdmin(req);
    const mantId = String(req.params.id || "");
    if (!isUuid(mantId)) return send(res, 400, "id inválido");
    const actorId = getActorId(req);

    const { equipo_ids } = req.body || {};
    if (!Array.isArray(equipo_ids) || equipo_ids.some(id => !isUuid(String(id)))) {
      return send(res, 400, "equipo_ids debe ser arreglo de UUID");
    }
    const out = await addResources(mantId, equipo_ids, actorId);
    return res.status(200).json(out); // { added }
  } catch (e) { return sendError(res, e); }
}

export async function removeResourceCtrl(req, res) {
  try {
    requireTechOrAdmin(req);
    const mantId = String(req.params.id || "");
    const equipoId = String(req.params.equipoId || "");
    if (!isUuid(mantId) || !isUuid(equipoId)) return send(res, 400, "ids inválidos");
    const actorId = getActorId(req);

    const ok = await removeResource(mantId, equipoId, actorId);
    if (!ok) return send(res, 404, "Recurso no asociado");
    return res.json({ ok: true });
  } catch (e) { return sendError(res, e); }
}

/** ===== GETs ===== */
export async function getMaintenanceCtrl(req, res) {
  try {
    const mantId = String(req.params.id || "");
    if (!isUuid(mantId)) return send(res, 400, "id inválido");
    const row = await getMaintenance(mantId);
    if (!row) return send(res, 404, "Mantenimiento no encontrado");
    return res.json(row);
  } catch (e) { return sendError(res, e); }
}

export async function listMaintenancesCtrl(req, res) {
  try {
    const { equipo_id, laboratorio_id, tecnico_id, tipo, from, to, limit, offset } = req.query || {};
    const out = await listMaintenances({
      equipo_id, laboratorio_id, tecnico_id, tipo, from, to, limit, offset
    });
    return res.json(out);
  } catch (e) { return sendError(res, e); }
}

/** ===== 2.3.4 Historial ===== */
export async function listMaintenanceHistoryCtrl(req, res) {
  try {
    const { equipo_id, laboratorio_id, from, to, limit, offset } = req.query || {};
    const out = await listMaintenanceHistory({ equipo_id, laboratorio_id, from, to, limit, offset });
    return res.json(out);
  } catch (e) { return sendError(res, e); }
}
