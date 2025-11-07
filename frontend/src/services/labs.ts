import api from "./api";

/* =========================
 * Tipos base
 * ========================= */
export type LabRow = {
  id: string; nombre: string; codigo_interno: string; ubicacion: string; descripcion: string | null;
};
export type LabDetail = {
  lab: LabRow & { created_at: string; updated_at: string };
  technicians: LabTechnician[];
  policies: LabPolicy[];
};

/* ---- Técnicos ---- */
export type LabTechnician = {
  id: string; usuario_id: string;
  usuario_nombre: string | null; usuario_correo: string;
  usuario_rol: "tecnico"|"admin"|"profesor"|"estudiante";
  usuario_telefono: string | null;
  cargo: "tecnico" | "encargado" | "asistente" | "otro";
  activo: boolean; asignado_desde: string | null; asignado_hasta: string | null;
};
export type EligibleUser = { id: string; nombre: string; correo: string; rol: "admin"|"tecnico"|"profesor"|"estudiante"; activo: boolean; };
export type CreateLabTechnicianDTO = { usuario_id: string; activo?: boolean; asignado_hasta?: string | null; };
export type UpdateLabTechnicianDTO = Partial<{ cargo: "tecnico"|"encargado"|"asistente"|"otro"; activo: boolean; asignado_hasta: string | null; }>;

/* ---- Políticas ---- */
export type LabPolicy = {
  id: string;
  nombre: string;
  descripcion: string | null;
  tipo: "academico"|"seguridad"|"otro";
  obligatorio: boolean;
  vigente_desde: string | null;
  vigente_hasta: string | null;
};

/* ---- Equipos ---- */
export type EquipoRow = {
  id: string; codigo_inventario: string; nombre: string;
  estado_operativo: "operativo"|"fuera_servicio"|"baja";
  fecha_ultimo_mantenimiento: string | null;
  tipo: "equipo"|"material"|"software";
  estado_disp: "disponible"|"reservado"|"en_mantenimiento"|"inactivo";
  cantidad_total: number; cantidad_disponible: number;
  ficha_tecnica: any; fotos: any; reservable: boolean;
  created_at: string; updated_at: string;
};

/* =========================
 * Labs
 * ========================= */
export async function listLabs(): Promise<LabRow[]> {
  const { data } = await api.get("/labs");
  return data as LabRow[];
}
export async function getLab(labId: string): Promise<LabDetail> {
  const { data } = await api.get(`/labs/${labId}`);
  return data as LabDetail;
}
export type LabCreate = { nombre: string; codigo_interno: string; ubicacion: string; descripcion?: string | null; };
export type LabPatch = Partial<LabCreate>;
export async function createLab(payload: LabCreate) {
  const { data } = await api.post("/labs", payload);
  return data as { id: string; created_at: string; updated_at: string };
}
export async function updateLab(labId: string, patch: LabPatch) {
  const { data } = await api.patch(`/labs/${labId}`, patch);
  return data; // backend devuelve detalle
}
export async function deleteLab(labId: string) {
  const { data } = await api.delete(`/labs/${labId}`);
  return data as { ok: boolean };
}
export async function listMyLabs(): Promise<LabRow[]> {
  const { data } = await api.get("/labs", { params: { mine: 1 } });
  return data as LabRow[];
}

/* =========================
 * Técnicos de lab
 * ========================= */
export async function listLabTechnicians(labId: string): Promise<LabTechnician[]> {
  const { data } = await api.get(`/labs/${labId}/technicians`);
  return data as LabTechnician[];
}
export async function listEligibleTechnicians(): Promise<EligibleUser[]> {
  const { data } = await api.get(`/users`, { params: { eligible: "techs" } });
  return data as EligibleUser[];
}
export async function addLabTechnician(labId: string, payload: CreateLabTechnicianDTO) {
  const { data } = await api.post(`/labs/${labId}/technicians`, payload);
  return data as { id: string };
}
export async function updateLabTechnician(labId: string, tecLabId: string, patch: UpdateLabTechnicianDTO) {
  const { data } = await api.patch(`/labs/${labId}/technicians/${tecLabId}`, patch);
  return data as { id: string };
}
export async function removeLabTechnician(labId: string, tecLabId: string) {
  await api.delete(`/labs/${labId}/technicians/${tecLabId}`);
}

/* =========================
 * Políticas del lab
 * ========================= */
export async function listLabPolicies(labId: string): Promise<LabPolicy[]> {
  const { data } = await api.get(`/labs/${labId}/policies`);
  return data as LabPolicy[];
}
export async function createLabPolicy(labId: string, payload: Omit<LabPolicy, "id">) {
  const { data } = await api.post(`/labs/${labId}/policies`, payload);
  return data as { id: string };
}
export async function updateLabPolicy(labId: string, policyId: string, patch: Partial<Omit<LabPolicy, "id">>) {
  const { data } = await api.patch(`/labs/${labId}/policies/${policyId}`, patch);
  return data as { id: string };
}
export async function deleteLabPolicy(labId: string, policyId: string) {
  const { data } = await api.delete(`/labs/${labId}/policies/${policyId}`);
  return data as { ok: boolean };
}

/* =========================
 * Equipos (1.1.3)
 * ========================= */
export async function listEquipos(labId: string) {
  const { data } = await api.get(`/labs/${labId}/equipos`);
  return data as EquipoRow[];
}
export async function listEquiposByCriteria({ labId, soloDisponibles = false }: { labId: string; soloDisponibles?: boolean }) {
  const params = new URLSearchParams();
  if (soloDisponibles) { params.set("estado_disp", "disponible"); params.set("reservable", "true"); }
  const { data } = await api.get(`/labs/${labId}/equipos${params.toString() ? `?${params}` : ""}`);
  return data as EquipoRow[];
}

/* =========================
 * Horarios (placeholder o real)
 * ========================= */
export type LabSlot = { fecha: string; desde: string; hasta: string; bloqueado?: boolean; motivo?: string | null };
export async function listLabHorarios(labId: string, fecha: string) {
  const { data } = await api.get(`/labs/${labId}/horarios?fecha=${fecha}`);
  return data as LabSlot[];
}
