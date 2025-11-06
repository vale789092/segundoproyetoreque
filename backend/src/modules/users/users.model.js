import { pool } from "../../db/index.js";

/**
 * Busca usuarios por nombre/correo/código (case-insensitive).
 * Excluye al propio usuario (excludeId).
 */
export async function searchUsersDB({ q, excludeId, limit = 20 }) {
  const term = `%${String(q || "").trim()}%`;

  const params = [excludeId, term, term, term, limit];
  const sql = `
    SELECT id, nombre, correo, rol
    FROM users
    WHERE id <> $1
      AND activo = TRUE
      AND (
        nombre ILIKE $2
        OR correo ILIKE $3
        OR codigo ILIKE $4
      )
    ORDER BY nombre ASC
    LIMIT $5
  `;
  const { rows } = await pool.query(sql, params);
  return rows;
}
