const KEY = "token";

export function setToken(token: string) {
  localStorage.setItem(KEY, token);
}
export function getToken(): string | null {
  return localStorage.getItem(KEY);
}
export function clearToken() {
  localStorage.removeItem(KEY);
}


const USER_KEY = "labtec_user";

export function setUser(user: any) {
  localStorage.setItem(USER_KEY, JSON.stringify(user || null));
}
export function getUser(): any | null {
  const raw = localStorage.getItem(USER_KEY);
  try { return raw ? JSON.parse(raw) : null; } catch { return null; }
}
export function clearUser() {
  localStorage.removeItem(USER_KEY);
}
