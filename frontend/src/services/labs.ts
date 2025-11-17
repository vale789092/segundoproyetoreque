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
  id: string;
  codigo_inventario: string;
  nombre: string;
  tipo: "equipo" | "material" | "software";
  estado_operativo: "operativo" | "fuera_servicio" | "baja";
  estado_disp: "disponible" | "reservado" | "en_mantenimiento" | "inactivo";
  reservable: boolean;
  cantidad_total: number;
  cantidad_disponible: number;
  fecha_ultimo_mantenimiento: string | null; // <- el backend lo expone así
  ficha_tecnica?: any;
  fotos?: any;
  created_at?: string;
  updated_at?: string;
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

export async function listEligibleTechnicians(
  labId: string
): Promise<EligibleUser[]> {
  const { data } = await api.get(`/labs/${labId}/eligible-technicians`);
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

export type LabBloqueo = {
  id: string;
  titulo: string;
  tipo: "evento" | "mantenimiento" | "uso_exclusivo" | "bloqueo";
  ts_inicio: string;   // ISO que devuelve el backend
  ts_fin: string;
  descripcion?: string | null;
};

export type CreateLabBloqueoInput = {
  titulo: string;
  tipo: LabBloqueo["tipo"];
  fecha: string;        // "YYYY-MM-DD"
  hora_inicio: string;  // "HH:MM" o "HH:MM:SS"
  hora_fin: string;     // idem
  descripcion?: string | null;
};

export async function listLabBloqueos(
  labId: string,
  params?: { desde?: string; hasta?: string }
): Promise<LabBloqueo[]> {
  const qs = new URLSearchParams();
  if (params?.desde) qs.set("desde", params.desde);
  if (params?.hasta) qs.set("hasta", params.hasta);

  const { data } = await api.get(
    `/labs/${labId}/horarios/bloqueos${qs.toString() ? `?${qs}` : ""}`
  );
  return data as LabBloqueo[];
}

export async function createLabBloqueo(
  labId: string,
  payload: CreateLabBloqueoInput
) {
  const { data } = await api.post(
    `/labs/${labId}/horarios/bloqueos`,
    payload
  );
  return data as { id: string };
}

export async function deleteLabBloqueo(labId: string, bloqueoId: string) {
  const { data } = await api.delete(
    `/labs/${labId}/horarios/bloqueos/${bloqueoId}`
  );
  return data as { ok: boolean };
}

export async function listEquiposByCriteria({ labId, soloDisponibles = false }: { labId: string; soloDisponibles?: boolean }) {
  const params = new URLSearchParams();
  if (soloDisponibles) { params.set("estado_disp", "disponible"); params.set("reservable", "true"); }
  const { data } = await api.get(`/labs/${labId}/equipos${params.toString() ? `?${params}` : ""}`);
  return data as EquipoRow[];
}

export async function listEquipos(labId: string, qs?: {
  tipo?: string; estado_disp?: string; reservable?: boolean;
}): Promise<EquipoRow[]> {
  const params = new URLSearchParams();
  if (qs?.tipo) params.set("tipo", qs.tipo);
  if (qs?.estado_disp) params.set("estado_disp", qs.estado_disp);
  if (qs?.reservable !== undefined) params.set("reservable", String(qs.reservable));
  const { data } = await api.get(`/labs/${labId}/equipos${params.size ? `?${params}` : ""}`);
  return data as EquipoRow[];
}

export async function getEquipo(labId: string, equipoId: string) {
  const { data } = await api.get(`/labs/${labId}/equipos/${equipoId}`);
  return data as EquipoRow;
}

export async function createEquipoAPI(labId: string, payload: Partial<EquipoRow>) {
  const { data } = await api.post(`/labs/${labId}/equipos`, payload);
  return data as { id: string };
}

export async function updateEquipoAPI(labId: string, equipoId: string, patch: Partial<EquipoRow>) {
  const { data } = await api.patch(`/labs/${labId}/equipos/${equipoId}`, patch);
  return data as EquipoRow; // tu controlador devuelve el equipo actualizado
}

export async function deleteEquipoAPI(labId: string, equipoId: string) {
  const { data } = await api.delete(`/labs/${labId}/equipos/${equipoId}`);
  return data as { ok: boolean };
}


/* =========================
 * Historial (bitácora)
 * ========================= */
export type LabHistoryRow = {
  id: string;
  laboratorio_id: string;
  accion: string;
  tipo?: string | null;
  equipo_id?: string | null;
  usuario_id?: string | null;
  usuario_nombre?: string | null;
  usuario_correo?: string | null;
  detalle?: any;                // JSON
  creado_en: string;            // ISO
};

export type ListHistoryParams = Partial<{
  accion: string | string[];    // "a,b,c" o array
  desde: string;                // YYYY-MM-DD
  hasta: string;                // YYYY-MM-DD
  equipo_id: string;
  tipo: string;
  q: string;
  limit: number;
  offset: number;
}>;

export async function listLabHistory(
  labId: string,
  params?: ListHistoryParams
): Promise<{ rows: LabHistoryRow[]; total?: number }> {
  const qs = new URLSearchParams();
  if (params) {
    const { accion, desde, hasta, equipo_id, tipo, q, limit, offset } = params;
    if (Array.isArray(accion)) qs.set("accion", accion.join(","));
    else if (accion) qs.set("accion", String(accion));
    if (desde) qs.set("desde", desde);
    if (hasta) qs.set("hasta", hasta);
    if (equipo_id) qs.set("equipo_id", String(equipo_id));
    if (tipo) qs.set("tipo", String(tipo));
    if (q) qs.set("q", String(q));
    if (typeof limit === "number") qs.set("limit", String(limit));
    if (typeof offset === "number") qs.set("offset", String(offset));
  }
  const url = `/labs/${labId}/history${qs.toString() ? `?${qs}` : ""}`;
  const { data } = await api.get(url);
  // backend puede devolver {rows,total} o [] — normalizamos
  if (Array.isArray(data)) return { rows: data, total: data.length };
  return data as { rows: LabHistoryRow[]; total?: number };
}

/* =========================
 * Horarios (placeholder o real)
 * ========================= */
export type LabSlot = {
  fecha: string;
  desde: string;
  hasta: string;
  bloqueado?: boolean;
  motivo?: string | null;
  tipo_bloqueo?:
    | "evento"
    | "mantenimiento"
    | "uso_exclusivo"
    | "bloqueo"
    | null;
  capacidad_maxima?: number | null;
  reservas_aprobadas?: number | null;
};

export async function listLabHorarios(labId: string, fecha: string) {
  const { data } = await api.get(`/labs/${labId}/horarios?fecha=${fecha}`);
  return data as LabSlot[];
}

export type CreateLabHorarioInput = {
  dow: number;              // 0=domingo ... 6=sábado
  hora_inicio: string;      // "HH:MM"
  hora_fin: string;         // "HH:MM"
  capacidad_maxima: number;
};

export async function createLabHorario(
  labId: string,
  payload: {
    dow: number;
    hora_inicio: string;
    hora_fin: string;
    capacidad_maxima: number;
  }
) {
  const { data } = await api.post(`/labs/${labId}/horarios`, payload);
  return data as { id: string };
}