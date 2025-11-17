import api, { parseError } from "./api";

export async function nextSlotsForLab(labId: string, limit = 1): Promise<{inicio:string, fin:string}[]> {
  try {
    const { data } = await api.get(`/labs/${labId}/next-slots?limit=${limit}`);
    // backend ideal: { slots:[{inicio,fin}] }
    return data?.slots ?? data ?? [];
  } catch (e) {
    // si todavía no existe el endpoint, devolvemos vacío
    return [];
  }
}
