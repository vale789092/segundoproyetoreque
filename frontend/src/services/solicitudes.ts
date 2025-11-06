// src/services/solicitudes.ts
import api from "./api";

export type SolicitudEstado = "pendiente" | "aprobada" | "rechazada" | "en_revision";

export type SolicitudRow = {
  id: string;
  estado: SolicitudEstado;
  creada_en: string;
  fecha_uso_inicio: string; // ISO
  fecha_uso_fin: string;    // ISO
  motivo: string | null;
  adjuntos: any;

  lab_id: string;
  lab_nombre: string;

  recurso_id: string;
  recurso_nombre: string;
  codigo_inventario: string;
};
export type SolicitudCreate = {
  laboratorio_id: string;
  equipo_id: string;
  fecha: string;       // YYYY-MM-DD
  hora_desde: string;  // HH:mm
  hora_hasta: string;  // HH:mm
  motivo?: string;
  adjuntos?: any;
  // adjuntos: más adelante como multipart/form-data
};

/** Crea solicitud del usuario autenticado */
export async function createSolicitud(payload: SolicitudCreate): Promise<{ id: string; estado: SolicitudEstado; creada_en: string }> {
  const { data } = await api.post("/requests", payload);
  return data;
}

/** Lista solicitudes del usuario autenticado (seguimiento) */
export async function listMisSolicitudes(estado?: SolicitudEstado): Promise<SolicitudRow[]> {
  const qs = new URLSearchParams({ ...(estado ? { estado } : {}) });
  const { data } = await api.get(`/requests${qs.toString() ? `?${qs}` : ""}`);
  return data as SolicitudRow[];
}

/** Cancela una solicitud propia en estado pendiente */
export async function cancelSolicitud(id: string): Promise<{ ok: boolean; id: string; estado: SolicitudEstado }> {
  const { data } = await api.delete(`/requests/${id}`);
  return data as { ok: boolean; id: string; estado: SolicitudEstado };
}