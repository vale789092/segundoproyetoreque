// frontend/src/services/users.ts
import api, { parseError } from "./api";
import type { Rol } from "./auth";

export type UserMini = {
  id: string;
  nombre: string;
  correo: string;
  rol: Rol;
  codigo?: string;
  carrera?: string;
  telefono?: string;
  activo?: boolean;
};

// Buscar usuarios por nombre/correo/código (usa /api/users/search)
export async function searchUsers(q: string): Promise<UserMini[]> {
  try {
    const { data } = await api.get("/users/search", {
      params: { q },
    });
    return (data?.users ?? []) as UserMini[];
  } catch (err) {
    throw new Error(parseError(err));
  }
}

/**
 * Mantiene la firma `listUsers()` que usabas en el front.
 * OJO: con el backend actual, si `q` es vacío, /users/search devuelve [].
 * Lo ideal es que desde el Perfil llames listUsers(q) cuando el usuario escriba en el buscador.
 */
export async function listUsers(q: string = ""): Promise<UserMini[]> {
  return searchUsers(q);
}

/**
 * Cambiar solo el rol (usa /api/admin/users/:userId/role)
 * → Esta función la dejamos por compatibilidad, aunque el Perfil
 *   ya no la usa directamente.
 */
export async function adminUpdateUserRole(
  userId: string,
  rol: Rol
): Promise<void> {
  try {
    await api.post(`/admin/users/${userId}/role`, { rol });
  } catch (err) {
    throw new Error(parseError(err));
  }
}

/**
 * Función que usa el Perfil:
 * - Llama a PATCH /api/admin/users/:userId con todos los campos editables.
 * - El backend actualiza nombre, correo, rol, código, carrera, teléfono, activo.
 * - Devuelve el usuario actualizado desde la BD.
 */
export async function adminUpdateUser(
  userId: string,
  payload: {
    nombre?: string;
    correo?: string;
    rol?: Rol;
    codigo?: string;
    carrera?: string;
    telefono?: string;
    activo?: boolean;
  }
): Promise<UserMini> {
  try {
    const { data } = await api.patch(`/admin/users/${userId}`, payload);
    // backend responde { user, message }
    return (data?.user ?? data) as UserMini;
  } catch (err) {
    throw new Error(parseError(err));
  }
}

/** Extra (si quieres usarlo): desactivar usuario */
export async function adminDeactivateUser(userId: string) {
  try {
    const { data } = await api.post(`/admin/users/${userId}/deactivate`);
    return data; // { id, activo: false, updated_at }
  } catch (err) {
    throw new Error(parseError(err));
  }
}

/**
 * Lista de usuarios elegibles para ser responsables de laboratorio.
 * Asume un endpoint tipo: GET /labs/:labId/eligible-technicians
 */
export async function listEligibleTechnicians(
  labId: string
): Promise<UserMini[]> {
  const { data } = await api.get(`/labs/${labId}/eligible-technicians`);
  return data as UserMini[];
}
