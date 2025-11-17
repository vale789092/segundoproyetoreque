import { searchUsersDB } from "./users.model.js";
import { updateUserById } from "../auth/auth.model.js";
import { deactivateUserById } from "./users.model.js";

// Si no las exportas, puedes volver a definirlas aquí:
const roles = ["estudiante", "profesor", "tecnico", "admin"];
function esRolValido(rol) {
  return roles.includes(String(rol).toLowerCase().trim());
}
const dominiosPorRolLocal = {
  estudiante: /^[^@\s]+@estudiantec\.cr$/i,
  profesor:   /^[^@\s]+@itcr\.ac\.cr$/i,
  tecnico:    /^[^@\s]+@itcr\.ac\.cr$/i,
  admin:      /^[^@\s]+@tec\.ac\.cr$/i,
};
function validarEmailyRol(email, rol) {
  const r = String(rol || "").toLowerCase().trim();
  if (!esRolValido(r)) return false;
  const regla = dominiosPorRolLocal[r];
  return regla.test(String(email || "").trim());
}
function isNumeric(v) {
  return /^[0-9]+$/.test(String(v));
}

/**
 * GET /api/users/search?q=texto
 */
export async function searchUsers(req, res, next) {
  try {
    const q = String(req.query.q || "").trim();
    const meId = req.user?.sub || req.user?.id;

    // si viene por /api/admin/users/... mostramos también inactivos
    const base = req.baseUrl || "";
    const isAdminPath = base.includes("/admin/users");

    const users = await searchUsersDB({
      q,
      excludeId: meId,
      limit: 50,
      includeInactive: isAdminPath,   // aquí ya será true para /api/admin/users/...
    });

    res.json({ users });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/admin/users/:userId
 * Admin actualiza datos de cualquier usuario (incluye rol y correo)
 */
export async function adminUpdateUser(req, res, next) {
  try {
    const userId = req.params.userId;
    if (!userId) {
      const e = new Error("Falta userId");
      e.status = 400;
      throw e;
    }

    let { nombre, correo, rol, codigo, carrera, telefono, activo } =
      req.body || {};

        // CASO ESPECIAL: solo cambiar "activo" (activar / desactivar)
    const soloCambiaActivo =
      nombre === undefined &&
      correo === undefined &&
      rol === undefined &&
      codigo === undefined &&
      carrera === undefined &&
      telefono === undefined &&
      typeof activo === "boolean";

    if (soloCambiaActivo) {
      const updated = await updateUserById(userId, { activo: !!activo });
      const { password_hash, ...safe } = updated;

      return res.json({
        user: safe,
        message: "Estado de la cuenta actualizado correctamente.",
      });
    }


    // Normalizar strings vacíos a null para NO forzar validaciones ni updates
    if (telefono === "") telefono = null;
    if (codigo === "") codigo = null;
    if (carrera === "") carrera = null;
    if (nombre === "") nombre = null;
    if (correo === "") correo = null;

    if (rol != null) {
      rol = String(rol).toLowerCase().trim();
      if (!esRolValido(rol)) {
        const e = new Error("Rol inválido.");
        e.status = 400;
        throw e;
      }
    }

    if (correo != null) {
      correo = String(correo).toLowerCase().trim();
    }

    if (telefono != null) {
      telefono = String(telefono).trim();
      // si sigue habiendo algo distinto de "", se valida
      if (telefono !== "" && (!isNumeric(telefono) || telefono.length !== 8)) {
        const e = new Error(
          "El teléfono debe tener exactamente 8 dígitos (ej: 88881234)."
        );
        e.status = 400;
        throw e;
      }
      if (telefono === "") telefono = null;
    }

    if (codigo != null) {
      codigo = String(codigo).trim();
      if (codigo !== "" && !isNumeric(codigo)) {
        const e = new Error("El código debe ser numérico.");
        e.status = 400;
        throw e;
      }
      if (codigo === "") codigo = null;
    }

    if (nombre != null) nombre = String(nombre).trim();
    if (carrera != null) carrera = String(carrera).trim();

    if (rol && correo && !validarEmailyRol(correo, rol)) {
      const e = new Error(
        `Correo no coincide con el dominio institucional para el rol '${rol}'.`
      );
      e.status = 400;
      throw e;
    }

    if (rol === "estudiante" && codigo != null && String(codigo).length !== 10) {
      const e = new Error("Para estudiantes, el código debe tener 10 dígitos.");
      e.status = 400;
      throw e;
    }

    const updated = await updateUserById(userId, {
      nombre,
      correo,
      rol,
      codigo,
      carrera,
      telefono,
      activo,
    });

    const { password_hash, ...safe } = updated;
    return res.json({
      user: safe,
      message: "Usuario actualizado correctamente.",
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/admin/users/:userId/deactivate
 * Desactiva la cuenta (activo = false) manteniendo el historial.
 */
export async function adminDeactivateUser(req, res, next) {
  try {
    const userId = req.params.userId;
    if (!userId) {
      const e = new Error("Falta userId");
      e.status = 400;
      throw e;
    }

    const updated = await deactivateUserById(userId);
    const { password_hash, ...safe } = updated;

    return res.json({
      user: safe,
      message: "Cuenta de usuario desactivada correctamente.",
    });
  } catch (err) {
    next(err);
  }
}