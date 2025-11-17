// src/services/storage.ts

// === Token ===
const TOKEN_KEY = "auth:token";
export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}
export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

// === Usuario ===
const USER_KEY = "labtec_user";
export function setUser(user: any) {
  localStorage.setItem(USER_KEY, JSON.stringify(user ?? null));
}
export function getUser<T = any>(): T | null {
  const raw = localStorage.getItem(USER_KEY);
  try { return raw ? (JSON.parse(raw) as T) : null; } catch { return null; }
}
export function clearUser() {
  localStorage.removeItem(USER_KEY);
}
