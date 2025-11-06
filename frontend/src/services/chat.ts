import api, { parseError } from "./api";
import { getToken } from "./storage";

export type ChatPeer = {
  id: string;
  nombre: string;
  correo: string;
  rol: "estudiante" | "profesor" | "tecnico" | "admin";
};

/** Busca usuarios reales en el backend */
export async function chatSearchPeers(query: string): Promise<ChatPeer[]> {
  try {
    if (!query?.trim()) return [];
    // api ya tiene baseURL y el interceptor del token (si lo usas),
    // pero si no, aquí un fallback:
    const headers: any = {};
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    const { data } = await api.get("/users/search", {
      params: { q: query },
      headers,
    });

    // El backend devuelve { users: [...] }
    return (data?.users ?? []) as ChatPeer[];
  } catch (err) {
    throw new Error(parseError(err));
  }
}
