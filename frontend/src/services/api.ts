import axios from "axios";
import { getToken } from "./storage";

export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000"

const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
});

api.interceptors.request.use((cfg) => {
  const t = getToken();
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

export function parseError(err: any): string {
  if (err?.response?.data?.message) return String(err.response.data.message);
  if (err?.response?.data?.error) return String(err.response.data.error);
  if (err?.message) return String(err.message);
  return "Error desconocido";
}

export default api; // <— default separado
