// src/services/notificaciones.ts
import api from "./api";

export type NotificacionRow = {
  id: string;
  usuario_id: string;
  titulo: string;
  mensaje: string;
  link?: string | null;
  leida: boolean;
  creada_en: string;
};

export async function listNotificaciones(opts?: {
  onlyUnread?: boolean;
  limit?: number;
}): Promise<NotificacionRow[]> {
  const qs = new URLSearchParams();
  if (opts?.onlyUnread) qs.set("onlyUnread", "true");
  if (opts?.limit) qs.set("limit", String(opts.limit));
  const { data } = await api.get(
    `/notifications${qs.toString() ? `?${qs}` : ""}`
  );
  return data as NotificacionRow[];
}

export async function marcarTodasLeidas(): Promise<void> {
  await api.post("/notifications/read-all", {});
}

export async function marcarNotificacionLeida(id: string): Promise<void> {
  await api.patch(`/notifications/${id}/read`, {});
}
