import { pool } from "../../db/index.js";

/**
 * Busca usuarios por nombre/correo/código (case-insensitive).
 * Excluye al propio usuario (excludeId).
 */
export async function searchUsersDB({
  q = "",
  excludeId = null,
  limit = 50,
  includeInactive = false,
}) {
  const values = [];
  const where = [];

  if (excludeId) {
    values.push(excludeId);
    where.push(`id <> $${values.length}`);
  }

  // solo filtramos por activo cuando NO queremos ver inactivos
  if (!includeInactive) {
    where.push(`activo = TRUE`);
  }

  if (q) {
    const like = `%${q.toLowerCase()}%`;
    values.push(like);
    const idx = values.length;
    where.push(
      `(LOWER(nombre) LIKE $${idx} OR LOWER(correo) LIKE $${idx} OR codigo LIKE $${idx})`
    );
  }

  const sql = `
    SELECT id, nombre, correo, rol, codigo, carrera, telefono, activo, created_at
    FROM users
    ${where.length ? "WHERE " + where.join(" AND ") : ""}
    ORDER BY nombre ASC
    LIMIT ${limit}
  `;

  const { rows } = await pool.query(sql, values);
  return rows;
}

export async function deactivateUserById(userId) {
  const { rows } = await pool.query(
    `
    UPDATE users
    SET activo = false
    WHERE id = $1
    RETURNING id, nombre, correo, rol, codigo, carrera, telefono, activo, created_at;
    `,
    [userId]
  );

  if (rows.length === 0) {
    const e = new Error("Usuario no encontrado");
    e.status = 404;
    throw e;
  }

  return rows[0];
}