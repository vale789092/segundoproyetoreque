import { searchUsersDB } from "./users.model.js";

/**
 * GET /api/users/search?q=texto
 * Auth: sí (cualquier rol)
 */
export async function searchUsers(req, res, next) {
  try {
    const q = String(req.query.q || "").trim();
    const meId = req.user?.id; // viene del middleware requireAuth
    if (!meId) {
      const e = new Error("Unauthorized");
      e.status = 401;
      throw e;
    }

    if (!q) {
      // Si no mandan query, devuelve vacío para no listar toda la tabla
      return res.json({ users: [] });
    }

    const users = await searchUsersDB({ q, excludeId: meId, limit: 20 });
    res.json({ users });
  } catch (err) {
    next(err);
  }
}
