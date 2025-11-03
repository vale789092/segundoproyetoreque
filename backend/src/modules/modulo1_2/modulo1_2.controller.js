import * as M from "./modulo1_2.model.js";

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const isUuid = (v) => typeof v === "string" && UUID_RE.test(v);
const send = (res, code, message) => res.status(code).json({ error: { code, message } });
function sendError(res, e) { if (e?.status) return send(res, e.status, e.message); switch (e?.code) {
  case "OVERLAP_SLOT": return send(res, 400, "Franja horaria traslapa con otra existente");
  case "23505": return send(res, 409, "Registro duplicado");
  case "23503": return send(res, 400, "Referencia inválida");
  case "23514":
  case "22P02": return send(res, 400, e.message || "Datos inválidos");
  default: return send(res, 500, e?.message || "Error interno del servidor");
}}

function getActorId(req) {
  return (
    req.user?.id ??
    req.user?.user?.id ??
    req.auth?.id ??
    req.auth?.user?.id ??
    null
  );
}

/* ==================== 1.2.1 — HORARIO BASE SEMANAL ==================== */
export async function createHorario(req, res) {
  try {
    const labId = String(req.params.labId || "");
    if (!isUuid(labId)) return send(res, 400, "labId inválido");
    const actorId = getActorId(req);
    const out = await M.createHorario(labId, req.body || {}, actorId);
    return res.status(201).json(out);
  } catch (e) { return sendError(res, e); }
}

export async function listHorarios(req, res) {
  try {
    const labId = String(req.params.labId || "");
    if (!isUuid(labId)) return send(res, 400, "labId inválido");
    const rows = await M.listHorarios(labId);
    return res.status(200).json(rows);
  } catch (e) { return sendError(res, e); }
}

export async function updateHorario(req, res) {
  try {
    const labId = String(req.params.labId || "");
    const slotId = String(req.params.slotId || "");
    if (!isUuid(labId) || !isUuid(slotId)) return send(res, 400, "ids inválidos");
    const actorId = getActorId(req);
    const out = await M.updateHorario(labId, slotId, req.body || {}, actorId);
    if (!out) return send(res, 404, "Franja no encontrada");
    return res.status(200).json(out);
  } catch (e) { return sendError(res, e); }
}

export async function deleteHorario(req, res) {
  try {
    const labId = String(req.params.labId || "");
    const slotId = String(req.params.slotId || "");
    if (!isUuid(labId) || !isUuid(slotId)) return send(res, 400, "ids inválidos");
    const actorId = getActorId(req);
    const ok = await M.deleteHorario(labId, slotId, actorId);
    if (!ok) return send(res, 404, "Franja no encontrada");
    return res.status(200).json({ ok: true });
  } catch (e) { return sendError(res, e); }
}
