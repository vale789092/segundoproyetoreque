// backend/src/modules/modulo3_3/modulo3_3.controller.js
import {
  createRequest, listMyRequests, getRequestById,
  updateRequestOwned, deletePendingOwned, setStatus, listRequestsAll,
} from "./modulo3_3.model.js";

function send(res, code, message) {
  return res.status(code).json({ error: { code, message } });
}
function mapError(res, e, next) {
  if (e?.status) return send(res, e.status, e.message);
  switch (e?.code) {
    case "23503": return send(res, 400, "Referencia inválida");
    case "23514":
    case "22P02": return send(res, 400, e.message || "Datos inválidos");
    case "OVERLAP_RES": return send(res, 409, "Traslape con otra reserva aprobada");
    case "NOT_RESERVABLE": return send(res, 400, "El recurso no es reservable");
    case "RESOURCE_MISMATCH": return send(res, 400, "El recurso no pertenece al laboratorio indicado");
    default: return next(e);
  }
}

/** POST /requests */
export async function createRequestCtrl(req, res, next) {
  try {
    const usuario_id = req.user.id;
    const { laboratorio_id, recurso_id, fecha_uso_inicio, fecha_uso_fin, motivo, adjuntos } = req.body || {};
    if (!laboratorio_id || !recurso_id || !fecha_uso_inicio || !fecha_uso_fin) {
      return send(res, 400, "Faltan campos: laboratorio_id, recurso_id, fecha_uso_inicio, fecha_uso_fin");
    }
    const created = await createRequest({
      usuario_id, laboratorio_id, recurso_id, fecha_uso_inicio, fecha_uso_fin, motivo, adjuntos,
    });
    return res.status(201).json({ id: created.id, estado: created.estado, creada_en: created.creada_en });
  } catch (e) { return mapError(res, e, next); }
}

/** GET /requests?estado=... */
export async function listMyRequestsCtrl(req, res, next) {
  try {
    const usuario_id = req.user.id;
    const { estado } = req.query || {};
    const rows = await listMyRequests({ usuario_id, estado });
    return res.json(rows);
  } catch (e) { return mapError(res, e, next); }
}

/** GET /requests/:id */
export async function getRequestCtrl(req, res, next) {
  try {
    const usuario_id = req.user.id;
    const rol = req.user.rol;
    const { id } = req.params;
    const row = await getRequestById({ id, usuario_id, rol });
    if (!row) return send(res, 404, "Solicitud no encontrada");
    return res.json(row);
  } catch (e) { return mapError(res, e, next); }
}

/** PATCH /requests/:id (editar del dueño si está 'pendiente' y no ha iniciado) */
export async function updateRequestCtrl(req, res, next) {
  try {
    const usuario_id = req.user.id;
    const { id } = req.params;
    const patch = req.body || {};
    const updated = await updateRequestOwned({ id, usuario_id, patch });
    if (!updated) return send(res, 400, "No se puede editar (no es tuya, no está 'pendiente' o ya inició)");
    return res.json(updated);
  } catch (e) { return mapError(res, e, next); }
}

/** DELETE /requests/:id */
export async function deleteRequestCtrl(req, res, next) {
  try {
    const usuario_id = req.user.id;
    const { id } = req.params;
    const deleted = await deletePendingOwned({ id, usuario_id });
    if (!deleted) return send(res, 400, "No se puede cancelar: debe ser tu solicitud, 'pendiente' y con fecha futura");
    return res.json({ ok: true, id: deleted.id, estado: deleted.estado });
  } catch (e) { return mapError(res, e, next); }
}

/** PATCH /requests/:id/status (técnico/admin) */
export async function setStatusCtrl(req, res, next) {
  try {
    const { id } = req.params;
    const { estado, aprobada_en } = req.body || {};
    const updated = await setStatus({ id, estado, aprobada_en, actor_user_id: req.user.id });
    if (!updated) return send(res, 404, "Solicitud no encontrada");
    return res.json(updated);
  } catch (e) { return mapError(res, e, next); }
}

export async function listRequestsAllCtrl(req, res, next) {
  try {
    const { estado, lab_id, q } = req.query || {};
    const limit  = Number.isFinite(+req.query?.limit)  ? Math.max(1, +req.query.limit)  : 50;
    const offset = Number.isFinite(+req.query?.offset) ? Math.max(0, +req.query.offset) : 0;

    const rows = await listRequestsAll({ estado, lab_id, q, limit, offset }); // ← llamar al MODEL
    return res.json(rows);
  } catch (e) {
    return mapError(res, e, next);
  }
}


