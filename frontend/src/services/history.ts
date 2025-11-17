import api from "./api";

export type MyHistoryRow = {
  id: string;
  laboratorio_id: string;
  lab_nombre: string;
  usuario_id: string;
  accion: string;              // p.ej. reserva_creada, reserva_aprobada, devolucion, etc.
  detalle: any;                // JSON con campos del evento
  creado_en: string;           // ISO
};

export async function listMyHistory(params?: { desde?: string; hasta?: string; tipo?: string }) {
  const { data } = await api.get("/history/me", { params });
  return data as MyHistoryRow[];
}
