// src/services/solicitudes.ts
import api, { parseError } from "./api";

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
  fecha_devolucion?: string | null;
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
  try {
    const { data } = await api.post("/requests", payload);
    return data;
  } catch (err: any) {
    // Propaga el 409 para mostrar mensaje específico
    if (err?.response?.status === 409) {
      throw new Error("Ya tienes una solicitud activa que se cruza para este recurso.");
    }
    throw err;
  }
}


export async function updateRequest(id: string, patch: any) {
  try {
    const { data } = await api.patch(`/requests/${id}`, patch);
    return data;
  } catch (err: any) {
    if (err?.response?.status === 409) {
      throw new Error("Ya tienes una solicitud activa que se cruza para este recurso.");
    }
    throw err;
  }
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

// --- NUEVO: obtener una solicitud por ID (admin/tecnico permitido por backend) ---
export async function getSolicitud(id: string): Promise<SolicitudRow & {
  aprobada_en?: string | null;
  fecha_devolucion?: string | null;
  usuario_id?: string;
  lab_ubicacion?: string;
}> {
  const { data } = await api.get(`/requests/${id}`);
  return data;
}

// --- NUEVO: cambiar estado (admin/tecnico) ---
export type SolicitudEstadoAdmin = "aprobada" | "rechazada" | "en_revision";

export async function setSolicitudEstado(
  id: string,
  estado: SolicitudEstadoAdmin,
  aprobada_en?: string | null
): Promise<{ id: string; estado: SolicitudEstadoAdmin; aprobada_en?: string | null }> {
  const { data } = await api.patch(`/requests/${id}/status`, { estado, aprobada_en });
  return data;
}


export type SolicitudAdminRow = SolicitudRow & {
  aprobada_en?: string | null;
  usuario_id: string;
  usuario_nombre?: string;
  usuario_correo?: string;
};

export async function listSolicitudesAdmin(params?: {
  estado?: SolicitudEstado; lab_id?: string; q?: string; limit?: number; offset?: number;
}) {
  const qs = new URLSearchParams();
  if (params?.estado) qs.set("estado", params.estado);
  if (params?.lab_id) qs.set("lab_id", params.lab_id);
  if (params?.q) qs.set("q", params.q);
  qs.set("limit", String(params?.limit ?? 50));
  qs.set("offset", String(params?.offset ?? 0));
  const { data } = await api.get(`/requests/admin/all?${qs.toString()}`);
  return data;
}

export async function setSolicitudStatus(id: string, estado: "aprobada"|"rechazada"|"en_revision") {
  const { data } = await api.patch(`/requests/${id}/status`, { estado });
  return data as { id: string; estado: SolicitudEstado; aprobada_en?: string | null };
}

export async function approveSolicitud(id: string): Promise<void> {
  try {
    await api.post(`/requests/${id}/approve`, {});
  } catch (err) {
    throw new Error(parseError(err));
  }
}