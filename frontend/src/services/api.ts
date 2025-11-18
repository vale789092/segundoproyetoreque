import axios from "axios";
import { getToken, clearToken, clearUser } from "./storage";

// Normaliza: quita / duplicados al final
function trimSlash(s?: string | null) {
  if (!s) return "";
  return String(s).replace(/\/+$/, "");
}

// Detecta el base URL del backend
function resolveApiBase(): string {
  // 1) Inyectadas por Vite (prod/dev)
  const env = (typeof import.meta !== "undefined" ? (import.meta as any).env : {}) || {};

  const asUrl = (env?.VITE_API_URL as string | undefined) || ""; // e.g. https://railway.app/api
  const asBase = (env?.VITE_API_BASE as string | undefined) || ""; // e.g. https://railway.app

  if (asUrl) return trimSlash(asUrl);

  if (asBase) return `${trimSlash(asBase)}/api`;

  // 2) Fallback de runtime (si alguna vez inyectás en window)
  const winAny = typeof window !== "undefined" ? (window as any) : undefined;
  if (winAny?.__API_URL__) return trimSlash(winAny.__API_URL__);

  // 3) Dev local por defecto
  return "http://localhost:3000/api";
}

const api = axios.create({
  baseURL: resolveApiBase(),
});

api.interceptors.request.use((cfg) => {
  const t = getToken();
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err?.response?.status === 401) {
      clearToken();
      clearUser();
      window.location.href = "/auth/login";
    }
    return Promise.reject(err);
  }
);

export default api;

export const parseError = (e: any) =>
  e?.response?.data?.message ?? e?.message ?? "Error";
