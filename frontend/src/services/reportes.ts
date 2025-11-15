// src/services/reportes.ts
import api from "./api";

export type UsoGlobalRow = {
  periodo: string;
  reservas: number;
  prestamos: number;
  mantenimientos: number;
};

export async function getUsoGlobal(params?: { from?: string; to?: string }) {
  const { data } = await api.get("/history/global-usage", { params });
  return data as UsoGlobalRow[];
}

export async function downloadUsoGlobalXlsx(params?: { from?: string; to?: string }) {
  const res = await api.get("/history/global-usage.xlsx", {
    params,
    responseType: "blob",
  });
  return res.data as Blob;
}

export async function downloadUsoGlobalPdf(params?: { from?: string; to?: string }) {
  const res = await api.get("/history/global-usage.pdf", {
    params,
    responseType: "blob",
  });
  return res.data as Blob;
}

export type InventarioRow = {
  lab_id: string;
  lab_nombre: string;
  recurso_id: string;
  recurso_nombre: string;
  estado: string;
  ubicacion: string;
};

export async function getInventario() {
  const { data } = await api.get("/history/inventory");
  return data as InventarioRow[];
}

export async function downloadInventarioXlsx() {
  const res = await api.get("/history/inventory.xlsx", {
    responseType: "blob",
  });
  return res.data as Blob;
}
