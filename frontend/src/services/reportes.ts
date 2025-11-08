import api from "./api";

export async function getUsoGlobal(params?: { from?: string; to?: string }) {
  const { data } = await api.get("/reportes/usage", { params });
  return data as Array<{ periodo: string; reservas: number; prestamos: number; mantenimientos: number }>;
}

export async function downloadUsoGlobalXlsx(params?: { from?: string; to?: string }) {
  const res = await api.get("/reportes/usage.xlsx", { params, responseType: "blob" });
  return res.data as Blob;
}

export async function getInventario() {
  const { data } = await api.get("/reportes/inventory");
  return data as Array<any>;
}

export async function downloadInventarioXlsx() {
  const res = await api.get("/reportes/inventory.xlsx", { responseType: "blob" });
  return res.data as Blob;
}
