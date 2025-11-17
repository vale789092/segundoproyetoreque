import { pool } from "../../db/index.js";

/* ---------- 4.1.2 ---------- */

const ALLOWED_ROLES = new Set(["estudiante", "profesor", "tecnico", "admin"]);

export async function setUserRole(userId, newRole) {
  if (!ALLOWED_ROLES.has(String(newRole))) {
    const e = new Error("rol inválido");
    e.code = "USR_INVALID_ROLE";
    throw e;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const u = await client.query(
      "SELECT id, rol, activo FROM users WHERE id = $1",
      [userId]
    );
    if (u.rowCount === 0) {
      const e = new Error("Usuario no encontrado");
      e.code = "USR_NOT_FOUND";
      throw e;
    }

    const current = u.rows[0];

    // Protección: no dejar el sistema sin admins activos
    if (current.rol === "admin" && newRole !== "admin") {
      const q = await client.query(
        "SELECT COUNT(*)::int AS cnt FROM users WHERE rol = 'admin' AND activo = TRUE AND id <> $1",
        [userId]
      );
      if (Number(q.rows[0].cnt || 0) === 0) {
        const e = new Error("No se puede remover al último admin activo");
        e.code = "USR_LAST_ADMIN";
        throw e;
      }
    }

    await client.query(
      "UPDATE users SET rol = $2, updated_at = NOW() WHERE id = $1",
      [userId, newRole]
    );

    await client.query("COMMIT");
    return true;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/* ---------- 4.1.4 ---------- */
export async function deactivateUser(userId) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1) Traer usuario
    const u = await client.query(
      "SELECT id, rol, activo FROM users WHERE id = $1",
      [userId]
    );
    if (u.rowCount === 0) {
      const e = new Error("Usuario no encontrado");
      e.code = "USR_NOT_FOUND";
      throw e;
    }
    const current = u.rows[0];

    // 2) Proteger último admin activo
    if (current.rol === "admin") {
      const q = await client.query(
        "SELECT COUNT(*)::int AS cnt FROM users WHERE rol = 'admin' AND activo = TRUE AND id <> $1",
        [userId]
      );
      if (Number(q.rows[0]?.cnt || 0) === 0) {
        const e = new Error("No se puede desactivar al último admin activo");
        e.code = "USR_LAST_ADMIN";
        throw e;
      }
    }

    // 3) Desactivar (idempotente) y actualizar updated_at
    const upd = await client.query(
      `UPDATE users
          SET activo = FALSE,
              updated_at = NOW()
        WHERE id = $1
        RETURNING id, activo, updated_at`,
      [userId]
    );

    await client.query("COMMIT");
    return upd.rows[0]; // { id, activo:false, updated_at:ts }
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}


