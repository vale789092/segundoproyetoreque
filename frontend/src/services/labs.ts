import api from "./api";

export type LabRow = {
  id: string;
  nombre: string;
  codigo_interno: string;
  ubicacion: string;
  descripcion: string | null;
};

export type LabDetail = {
  lab: LabRow & { created_at: string; updated_at: string };
  technicians: Array<{
    id: string;
    usuario_id: string;
    usuario_nombre: string;
    usuario_correo: string;
    usuario_rol: string;
    usuario_telefono: string | null;
    cargo: string;
    activo: boolean;
    asignado_desde: string | null;
    asignado_hasta: string | null;
  }>;
  policies: Array<{
    id: string;
    nombre: string;
    descripcion: string | null;
    tipo: "academico" | "seguridad" | "otro";
    obligatorio: boolean;
    vigente_desde: string | null;
    vigente_hasta: string | null;
  }>;
};

export async function listLabs(): Promise<LabRow[]> {
  const { data } = await api.get("/labs");
  // OJO: tu backend devuelve un array, no { labs }
  return data as LabRow[];
}

export async function getLab(labId: string): Promise<LabDetail> {
  const { data } = await api.get(`/labs/${labId}`);
  return data as LabDetail;
}

export async function listEquipos(labId: string) {
  const { data } = await api.get(`/labs/${labId}/equipos`);
  return data as any[];
}

// Si implementas la opción A:
export async function labsSummary() {
  const { data } = await api.get("/labs/summary");
  return data as {
    totalLabs: number;
    totalEquiposReservables: number;
    totalPoliticas: number;
    tecnicosActivos: number;
    recientes: any[];
  };
}


export type LabCreate = {
  nombre: string;
  codigo_interno: string;
  ubicacion: string;
  descripcion?: string | null;
};
export type LabPatch = Partial<LabCreate>;


export async function createLab(payload: LabCreate): Promise<{id:string;created_at:string;updated_at:string}> {
  const { data } = await api.post("/labs", payload);
  return data;
}

export async function updateLab(labId: string, patch: LabPatch) {
  const { data } = await api.patch(`/labs/${labId}`, patch);
  return data; // detalle completo { lab, technicians, policies }
}

export async function deleteLab(labId: string) {
  const { data } = await api.delete(`/labs/${labId}`);
  return data as { ok: boolean };
}
