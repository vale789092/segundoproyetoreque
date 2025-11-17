import api, { parseError } from "./api";

export type Id = string;
export type MantTipo = "preventivo"|"correctivo"|"calibracion"|"inspeccion"|"otro";

const MAINT_BASE = "/maintenances"; // 👈 PLURAL (coincide con tu index.js)

export type MaintenanceCreate = {
  programado_para: string;   // ISO
  tipo: MantTipo;
  tecnico_id: Id;
  procedimientos?: string | null;
  repuestos_usados?: any | null;
  observaciones?: string | null;
  equipo_ids?: Id[];
};
export type MaintenancePatch = Partial<MaintenanceCreate>;

export type MaintenanceRow = {
  id: Id;
  programado_para: string;
  tipo: MantTipo;
  tecnico_id: Id;
  procedimientos?: string | null;
  repuestos_usados?: any | null;
  observaciones?: string | null;
  equipos?: { id: Id; nombre: string; laboratorio_id: Id }[];
};


export type MaintenanceDetail = MaintenanceRow & {
  procedimientos?: string | null;
  repuestos_usados?: any;
  observaciones?: string | null;
  recursos: { id: string; laboratorio_id: string; nombre: string }[];
};

const toParams = (p: Record<string, unknown> = {}) =>
  Object.fromEntries(Object.entries(p).filter(([,v]) => v !== undefined && v !== null && v !== ""));

/* ---- READ ---- */
export async function listMaintenances(params?: {
  laboratorio_id?: Id; tecnico_id?: Id; desde?: string; hasta?: string; q?: string; limit?: number; offset?: number;
}) {
  try {
    const { data } = await api.get(MAINT_BASE, { params: toParams(params) });
    return data as MaintenanceRow[];
  } catch (e) { throw new Error(parseError(e)); }
}

export async function getMaintenance(id: Id) {
  try {
    const { data } = await api.get(`${MAINT_BASE}/${id}`);
    return data as MaintenanceRow;
  } catch (e) { throw new Error(parseError(e)); }
}

/* ---- CREATE / PATCH ---- */
export async function createMaintenance(payload: MaintenanceCreate) {
  try {
    const { data } = await api.post(MAINT_BASE, payload);
    return data as { id: Id };
  } catch (e) { throw new Error(parseError(e)); }
}

export async function updateMaintenance(id: Id, patch: MaintenancePatch) {
  try {
    const { data } = await api.patch(`${MAINT_BASE}/${id}`, patch);
    return data as { id: Id };
  } catch (e) { throw new Error(parseError(e)); }
}

/* ---- EQUIPOS <-> MANTENIMIENTO ---- */
// 👇 el back usa "resources" (no "recursos")
export async function addResources(mantId: Id, equipo_ids: Id[]) {
  try {
    const { data } = await api.post(`${MAINT_BASE}/${mantId}/resources`, { equipo_ids });
    return data as { added: number };
  } catch (e) { throw new Error(parseError(e)); }
}

export async function removeResource(mantId: Id, equipoId: Id) {
  try {
    const { data } = await api.delete(`${MAINT_BASE}/${mantId}/resources/${equipoId}`);
    return data as { ok: boolean };
  } catch (e) { throw new Error(parseError(e)); }
}

/* ---- helper ---- */
export const localToISO = (dtLocal: string) => {
  const d = new Date(dtLocal);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
};
