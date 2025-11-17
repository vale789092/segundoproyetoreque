import * as M from "./modulo4_1.model.js";

const bad = (res, msg) => res.status(400).json({ error: msg });

const UUID_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const isUuid = (v) => typeof v === "string" && UUID_RE.test(v);

function mapPg(e, res, next) {
  if (!e?.code) return next(e);
  const m = {
    "23505": [409, "Recurso duplicado"],
    "23503": [400, "Referencia inválida"],
    "23514": [400, "Violación de regla de datos"],
    "22P02": [400, "Dato inválido"],
    "USR_INVALID_ROLE": [400, "rol inválido (estudiante|profesor|tecnico|admin)"],
    "USR_NOT_FOUND": [404, "Usuario no encontrado"],
    "USR_LAST_ADMIN": [409, "No se puede remover al último admin activo"],
  };
  const r = m[e.code];
  return r
    ? res.status(r[0]).json({ error: r[1], detail: e.detail || e.constraint || e.message })
    : next(e);
}

/**
 * 4.1.2 — Asignación de roles
 * POST /api/admin/users/:userId/role
 * Body: { "rol": "tecnico" | "profesor" | "estudiante" | "admin" }
 */
export async function postAssignRole(req, res, next) {
  try {
    const userId = String(req.params.userId || "");
    const { rol } = req.body || {};
    if (!rol) return bad(res, "rol requerido");

    await M.setUserRole(userId, String(rol));
    return res.status(204).end();
  } catch (e) {
    return mapPg(e, res, next);
  }
}

/**
 * 4.1.4 — Baja de usuarios (desactivación)
 * POST /api/admin/users/:userId/deactivate
 * Body: vacío (opcional) — solo acción
 */
export async function postDeactivateUser(req, res, next) {
  try {
    const userId = String(req.params.userId || "");
    if (!isUuid(userId)) return bad(res, "userId inválido");

    const out = await M.deactivateUser(userId);
    // Devuelve estado final para facilidad de consumo en el front
    return res.status(200).json(out); // { id, activo:false, updated_at }
  } catch (e) {
    return mapPg(e, res, next);
  }
}