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

// Buscar usuarios por nombre/correo/código (usa /api/admin/users/search para admin)
export async function searchUsers(q: string): Promise<UserMini[]> {
  try {
    const { data } = await api.get("/admin/users/search", {
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
 * 4.1.2 — Asignación de roles
 * Usa módulo 4_1 → POST /api/admin/users/:userId/role
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
 * Edición completa de usuario desde el Perfil (admin):
 * - Si viene `rol`, primero lo actualiza usando módulo 4_1 (postAssignRole).
 * - Luego hace PATCH /api/admin/users/:userId para nombre/correo/código/carrera/teléfono/activo.
 *
 * Así nos aseguramos de:
 *   - Usar la lógica de 4.1.2 para roles (protección último admin, etc.).
 *   - Seguir usando updateUserById para el resto de campos.
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
    // 1) Si hay cambio de rol, usar módulo 4_1
    if (payload.rol) {
      await adminUpdateUserRole(userId, payload.rol);
    }

    // 2) PATCH para el resto de campos (sin tocar rol aquí)
    const { rol, ...rest } = payload;
    const { data } = await api.patch(`/admin/users/${userId}`, rest);

    // backend responde { user, message } o similar
    return (data?.user ?? data) as UserMini;
  } catch (err) {
    throw new Error(parseError(err));
  }
}

/**
 * 4.1.4 — Baja de usuarios (desactivación)
 * Usa módulo 4_1 → POST /api/admin/users/:userId/deactivate
 */
export async function adminDeactivateUser(userId: string) {
  try {
    const { data } = await api.post(`/admin/users/${userId}/deactivate`);
    // módulo 4_1 responde { id, activo:false, updated_at }
    return data as UserMini;
  } catch (err) {
    throw new Error(parseError(err));
  }
}

/**
 * Alta de usuarios (reactivación)
 * Usa módulo 4_1 → POST /api/admin/users/:userId/activate
 */
export async function adminActivateUser(userId: string) {
  try {
    const { data } = await api.post(`/admin/users/${userId}/activate`);
    // módulo 4_1 responde { id, activo:true, updated_at }
    return data as UserMini;
  } catch (err) {
    throw new Error(parseError(err));
  }
}
