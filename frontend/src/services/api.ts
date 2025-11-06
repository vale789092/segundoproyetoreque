import axios from "axios";
import { getToken, clearToken, clearUser } from "./storage"; 

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:3000/api",
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

// (si exportas helpers):
export const parseError = (e: any) =>
  e?.response?.data?.message ?? e?.message ?? "Error";
