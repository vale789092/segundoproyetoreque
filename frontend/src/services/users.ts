// src/services/users.ts
import api from "./api";

export type UserMini = {
  id: string;
  nombre: string;
  correo: string;
  rol: "estudiante" | "profesor" | "tecnico" | "admin";
  activo?: boolean;
};

/**
 * Lista de usuarios elegibles para ser responsables de laboratorio.
 * Asume un endpoint tipo: GET /users?roles=tecnico,admin&activo=1
 * Ajusta los params si tu backend usa otra firma.
 */
export async function listEligibleTechnicians(labId: string): Promise<UserMini[]> {
  const { data } = await api.get(`/labs/${labId}/eligible-technicians`);
  return data as UserMini[];
}