import api, { parseError } from "./api";
import { setToken, clearToken } from "./storage";
import { setUser, clearUser } from "./storage"; // ← añade

// Tipos
export type Rol = "estudiante" | "profesor" | "tecnico" | "admin";

export type RegisterPayload = {
  nombre: string;
  correo: string;       // dominio debe calzar con el rol
  password: string;
  codigo: string;       // numérico (10 dígitos si es estudiante)
  rol: Rol;
  carrera: string;
  telefono: string;     // 8 dígitos
};

export type LoginPayload = {
  correo: string;
  password: string;
};

export async function register(payload: RegisterPayload) {
  try {
    const { data } = await api.post("/auth/register", payload);
    return data;
  } catch (err) {
    throw new Error(parseError(err));
  }
}

export async function login(payload: LoginPayload) {
  try {
    const { data } = await api.post("/auth/login", payload);
    // backend devuelve { token, token_type, expires_in, user }
    setToken(data?.token);
    setUser(data?.user);
    return data;
  } catch (err) {
    throw new Error(parseError(err));
  }
}

export async function logout() {
  try {
    await api.post("/auth/logout");
  } catch {
    // ignore
  } finally {
    clearToken();
    clearUser();
  }
}

export async function me() {
  try {
    const { data } = await api.get("/auth/me");
    return data?.me;
  } catch (err) {
    throw new Error(parseError(err));
  }
}
