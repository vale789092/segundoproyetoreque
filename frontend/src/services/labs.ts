// services/labs.ts
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

export async function listMyLabs(): Promise<LabRow[]> {
  // Requiere que el backend soporte GET /labs?mine=1 (lo dejamos listo)
  const { data } = await api.get("/labs", { params: { mine: 1 } });
  return data as LabRow[];
}


export type EquipoRow = {
  id: string;
  codigo_inventario: string;
  nombre: string;
  estado_operativo: "operativo"|"fuera_servicio"|"baja";
  fecha_ultimo_mantenimiento: string | null;
  tipo: "equipo"|"material"|"software";
  estado_disp: "disponible"|"reservado"|"en_mantenimiento"|"inactivo";
  cantidad_total: number;
  cantidad_disponible: number;
  ficha_tecnica: any;
  fotos: any;
  reservable: boolean;
  created_at: string;
  updated_at: string;
};

export async function listEquiposByCriteria(
  { labId, soloDisponibles = false }: { labId: string; soloDisponibles?: boolean }
): Promise<EquipoRow[]> {
  const params = new URLSearchParams();
  if (soloDisponibles) { params.set("estado_disp", "disponible"); params.set("reservable", "true"); }
  const { data } = await api.get(`/labs/${labId}/equipos${params.toString() ? `?${params}` : ""}`);
  return data as EquipoRow[];
}

/**
 * Horarios del laboratorio (mock por ahora):
 * Cuando implementes el endpoint real, cámbialo a:
 *   GET /labs/:labId/horarios?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
 */
export type LabSlot = {
  fecha: string;      // "2025-11-06"
  desde: string;      // "08:00"
  hasta: string;      // "12:00"
  bloqueado?: boolean;
  motivo?: string | null;
};

export async function listLabHorariosMock(labId: string, diaISO: string): Promise<LabSlot[]> {
  // MOCK determinista por día; reemplazar por fetch real cuando exista endpoint
  // p.ej. GET /labs/:labId/horarios?fecha=YYYY-MM-DD
  const weekday = new Date(diaISO).getDay(); // 0..6
  if (!labId) return [];
  // ejemplo simple: L-V 08-12 y 13-17 disponibles; miércoles 13-15 bloqueado
  const base: LabSlot[] = [
    { fecha: diaISO, desde: "08:00", hasta: "12:00" },
    { fecha: diaISO, desde: "13:00", hasta: "17:00" },
  ];
  if (weekday === 3) {
    base[1] = { ...base[1], bloqueado: true, motivo: "Mantenimiento" };
  }
  return base;
}

// services/labs.ts
export async function listLabHorarios(labId: string, fecha: string) {
  const { data } = await api.get(`/labs/${labId}/horarios?fecha=${fecha}`);
  return data as LabSlot[];
}
