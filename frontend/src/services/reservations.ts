// services/reservations.ts
import api, { parseError } from "./api";

export type Reservation = {
  id: string;
  lab_id: string;
  labNombre?: string;
  resource_id: string;
  recursoNombre?: string;
  estado: string;
  fecha_uso?: string;
  hora_inicio?: string;
  hora_fin?: string;
  created_at?: string;
};

export async function myRecentReservations(limit = 5): Promise<Reservation[]> {
  try {
    const { data } = await api.get(`/reservations/mine?limit=${limit}`);
    // backend ideal: { items: [...] }
    return data?.items ?? data ?? [];
  } catch (e) {
    throw new Error(parseError(e));
  }
}
