import { pool } from "../../db/index.js";

export async function createUser({ nombre, correo, passwordHash, codigo, rol, carrera, telefono }) {
  const querydb = `
    INSERT INTO users (nombre, correo, password_hash, codigo, rol, carrera, telefono)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id, nombre, correo, codigo, rol, carrera, telefono, created_at
  `;
  const params = [nombre, correo, passwordHash, codigo, rol, carrera, telefono];

  try {

    const result = await pool.query(querydb, params);
    const rows = result.rows
    return rows[0];

  } catch (err) {
    // 23505 = unique_violation (correo o codigo repetidos)
    if (err.code === "23505") {
      const field = err?.detail?.includes("(correo)") ? "correo" : err?.detail?.includes("(codigo)") ? "codigo" : "único";
      const e = new Error(`Ya existe un usuario con ese ${field}.`);
      e.status = 409;
      throw e;
    }
    // 23514 = check_violation (p. ej., rol inválido o correo no institucional)
    if (err.code === "23514") {
      const e = new Error("Datos inválidos (revisa rol y correo institucional).");
      e.status = 400;
      throw e;
    }
    throw err;
  }
};


export async function getUserByEmail(correo) {
  const q = `
    SELECT id, nombre, correo, password_hash, codigo, rol, carrera, telefono, activo, created_at
    FROM users
    WHERE correo = $1
    LIMIT 1
  `;
  const { rows } = await pool.query(q, [correo]);
  return rows[0] || null;
};

// Actualiza campos permitidos de un usuario y retorna el registro completo
export async function updateUserById(id, fields = {}) {
  const allowed = ["nombre", "correo", "codigo", "rol", "carrera", "telefono"];
  const keys = Object.keys(fields).filter((k) => allowed.includes(k) && fields[k] != null);

  if (keys.length === 0) {
    const e = new Error("No hay cambios para actualizar.");
    e.status = 400;
    throw e;
  }

  const sets = keys.map((k, i) => `${k} = $${i + 2}`).join(", ");
  const params = [id, ...keys.map((k) => fields[k])];

  const q = `
    UPDATE users
       SET ${sets}, updated_at = NOW()
     WHERE id = $1
     RETURNING id, nombre, correo, password_hash, codigo, rol, carrera, telefono, activo, created_at
  `;

  try {
    const { rows } = await pool.query(q, params);
    return rows[0];
  } catch (err) {
    if (err.code === "23505") { // unique_violation
      const field = err?.detail?.includes("(correo)") ? "correo" :
                    err?.detail?.includes("(codigo)") ? "codigo" : "campo único";
      const e = new Error(`Ya existe un usuario con ese ${field}.`);
      e.status = 409;
      throw e;
    }
    if (err.code === "23514") { // check_violation (si tu DB tiene checks)
      const e = new Error("Datos inválidos (revisa rol/correo/código).");
      e.status = 400;
      throw e;
    }
    throw err;
  }
}
