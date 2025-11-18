// frontend/src/services/prestamos.ts
import api, { parseError } from "./api";

export type EstadoPrestamoFiltro = "activos" | "devueltos" | "todos";

export type PrestamoItem = {
  solicitud_id: string;
  usuario_id: string;
  usuario_nombre: string;
  usuario_codigo: string;
  recurso_id: string;
  recurso_nombre: string;
  laboratorio_id: string;
  laboratorio_nombre: string;
  fecha_uso_inicio: string;
  fecha_uso_fin: string;
  aprobada_en?: string | null;
  fecha_devolucion?: string | null;
  estado_disp: "disponible" | "reservado" | "en_mantenimiento" | "inactivo";
};

export type PrestamoRow = PrestamoItem;

export async function listPrestamos(opts?: {
  estado?: EstadoPrestamoFiltro;
  q?: string;
}): Promise<PrestamoItem[]> {
  try {
    const { estado = "activos", q } = opts ?? {};
    const { data } = await api.get("/prestamos", {
      params: { estado, q },
    });
    return (data?.items ?? []) as PrestamoItem[];
  } catch (err) {
    throw new Error(parseError(err));
  }
}

// Devoluciones = mismos datos pero filtrando por estado devueltos
export async function listDevoluciones(opts?: {
  q?: string;
}): Promise<PrestamoItem[]> {
  try {
    const { q } = opts ?? {};
    const { data } = await api.get("/prestamos", {
      params: { estado: "devueltos", q },
    });
    return (data?.items ?? []) as PrestamoItem[];
  } catch (err) {
    throw new Error(parseError(err));
  }
}

// Usamos el id de la SOLICITUD aprobada
export async function registrarDevolucion(
  solicitudId: string
): Promise<void> {
  try {
    await api.patch(`/prestamos/${solicitudId}/devolucion`, {});
  } catch (err) {
    throw new Error(parseError(err));
  }
}
