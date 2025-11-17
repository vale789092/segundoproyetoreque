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

/* ---------- RESUMEN (bitácora personal) ---------- */

export type MyUsageRow = {
  solicitud_id: string | null;
  tipo_evento: string;
  ts: string; // ISO
  estado: string | null;
  laboratorio: { id: string | null; nombre: string | null } | null;
  recurso: { id: string | null; nombre: string | null } | null;
};

export async function getMyUsage(params?: {
  from?: string;
  to?: string;
  tipo?: "all" | "solicitudes" | "uso" | "devolucion";
}) {
  const { data } = await api.get("/history/my-usage", { params });
  return data as MyUsageRow[];
}

export async function downloadMyUsageXlsx(params?: {
  from?: string;
  to?: string;
  tipo?: "all" | "solicitudes" | "uso" | "devolucion";
}) {
  const res = await api.get("/history/my-usage.xlsx", {
    params,
    responseType: "blob",
  });
  return res.data as Blob;
}

export async function downloadMyUsagePdf(params?: {
  from?: string;
  to?: string;
  tipo?: "all" | "solicitudes" | "uso" | "devolucion";
}) {
  const res = await api.get("/history/my-usage.pdf", {
    params,
    responseType: "blob",
  });
  return res.data as Blob;
}

/* ---------- INVENTARIO ---------- */

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

export async function downloadInventarioPdf() {
  const res = await api.get("/history/inventory.pdf", {
    responseType: "blob",
  });
  return res.data as Blob;
}


