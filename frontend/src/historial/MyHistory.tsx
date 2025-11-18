import { useEffect, useMemo, useState } from "react";
import { Button, Card, TextInput } from "flowbite-react";
import { listMyHistory, MyHistoryRow } from "@/services/history";
import { exportJsonToXlsx } from "@/utilidad/exportXlsx";

const PAGE_SIZE = 5;

function toDateInputValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatDateTime(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-CR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function prettyAccion(accion: string) {
  // reserva_creada -> Reserva creada
  return accion
    .replace(/_/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase());
}

function prettyTipo(raw: string | null | undefined, accion: string) {
  // Si el JSON trae tipo lo usamos, si no inferimos desde la acción
  let base = raw;
  const a = accion.toLowerCase();

  if (!base) {
    if (a.includes("reserva")) base = "reserva";
    else if (a.includes("prestamo")) base = "prestamo";
    else if (a.includes("devoluc")) base = "devolucion";
    else if (a.includes("capacit")) base = "capacitacion";
    else base = "otro";
  }

  const map: Record<string, string> = {
    reserva: "Reserva",
    prestamo: "Préstamo",
    devolucion: "Devolución",
    capacitacion: "Capacitación",
    otro: "Otro",
  };
  return map[base] ?? base.charAt(0).toUpperCase() + base.slice(1);
}

function formatDetalle(detalle: any): string {
  if (!detalle) return "—";

  const parts: string[] = [];

  if (detalle.fecha_uso_inicio || detalle.fecha_uso_fin) {
    const desde = formatDateTime(detalle.fecha_uso_inicio);
    const hasta = formatDateTime(detalle.fecha_uso_fin);
    if (desde !== "—" || hasta !== "—") {
      parts.push(`Uso: ${desde} – ${hasta}`);
    }
  }

  if (detalle.estado) {
    parts.push(`Estado: ${detalle.estado}`);
  }

  if (detalle.solicitud_id) {
    const shortId = String(detalle.solicitud_id);
    parts.push(`Solicitud asociada (${shortId.slice(0, 8)}…)`);
  }

  if (detalle.recurso_id) {
    const shortRec = String(detalle.recurso_id);
    parts.push(`Recurso (${shortRec.slice(0, 8)}…)`);
  }

  return parts.length ? parts.join(" · ") : "—";
}

export default function MyHistory() {
  const [desde, setDesde] = useState<string>(() =>
    toDateInputValue(new Date(Date.now() - 30 * 86400000))
  );
  const [hasta, setHasta] = useState<string>(() =>
    toDateInputValue(new Date())
  );

  const [rows, setRows] = useState<MyHistoryRow[]>([]);
  const [loading, setLoading] = useState(false);

  // paginación
  const [page, setPage] = useState(0);

  async function fetchData() {
    setLoading(true);
    try {
      const data = await listMyHistory({
        desde: desde ? new Date(desde).toISOString() : undefined,
        // hasta exclusivo → sumamos 1 día
        hasta: hasta
          ? new Date(
              new Date(hasta).getTime() + 24 * 60 * 60 * 1000
            ).toISOString()
          : undefined,
      });
      setRows(data);
      setPage(0); // reset a primera página
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // filas visibles en la página actual
  const visibleRows = useMemo(() => {
    const start = page * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    return rows.slice(start, end);
  }, [rows, page]);

  const total = rows.length;
  const canPrev = page > 0;
  const canNext = (page + 1) * PAGE_SIZE < total;

  // data “plana” para Excel (sin JSON crudo)
  const flatRows = useMemo(
    () =>
      rows.map((r) => {
        const d: any = r.detalle ?? {};
        return {
          id: r.id,
          fecha: formatDateTime(r.creado_en),
          laboratorio: r.lab_nombre,
          accion: prettyAccion(r.accion),
          tipo: prettyTipo(d.tipo, r.accion),
          solicitud_id: d.solicitud_id ?? "",
          recurso_id: d.recurso_id ?? "",
          fecha_uso_inicio: d.fecha_uso_inicio ?? "",
          fecha_uso_fin: d.fecha_uso_fin ?? "",
          estado_detalle: d.estado ?? "",
        };
      }),
    [rows]
  );

  return (
    <div className="space-y-4">
      {/* Encabezado + acciones */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">Mi historial</h3>
        <div className="flex gap-2">
          <Button color="light" onClick={fetchData} isProcessing={loading}>
            Refrescar
          </Button>
          <Button
            className="bg-primary text-white"
            onClick={() => exportJsonToXlsx(flatRows, "mi_historial.xlsx")}
            disabled={!rows.length}
          >
            Exportar a Excel
          </Button>
        </div>
      </div>

      {/* Filtros (solo fechas) */}
      <Card>
        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Desde</label>
            <TextInput
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Hasta</label>
            <TextInput
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <Button
              onClick={fetchData}
              isProcessing={loading}
              className="w-full bg-primary text-white"
            >
              Aplicar
            </Button>
          </div>
        </div>
      </Card>

      {/* Tabla */}
      <Card>
        {loading ? (
          <p className="text-sm text-slate-500">Cargando…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-slate-500">
            No hay eventos para el filtro seleccionado.
          </p>
        ) : (
          <>
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b bg-slate-50/60">
                    <th className="py-3 px-4 whitespace-nowrap text-xs font-medium">
                      Fecha
                    </th>
                    <th className="py-3 px-4 whitespace-nowrap text-xs font-medium">
                      Laboratorio
                    </th>
                    <th className="py-3 px-4 whitespace-nowrap text-xs font-medium">
                      Acción
                    </th>
                    <th className="py-3 px-4 whitespace-nowrap text-xs font-medium">
                      Tipo
                    </th>
                    <th className="py-3 px-4 text-xs font-medium">Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((r) => {
                    const d: any = r.detalle ?? {};
                    return (
                      <tr key={r.id} className="border-t">
                        <td className="py-4 px-4 whitespace-nowrap align-top text-xs sm:text-sm">
                          {formatDateTime(r.creado_en)}
                        </td>
                        <td className="py-4 px-4 whitespace-nowrap align-top text-xs sm:text-sm">
                          {r.lab_nombre}
                        </td>
                        <td className="py-4 px-4 whitespace-nowrap align-top">
                          <span className="inline-flex rounded-full bg-blue-50 text-blue-700 px-3 py-1 text-xs font-medium">
                            {prettyAccion(r.accion)}
                          </span>
                        </td>
                        <td className="py-4 px-4 whitespace-nowrap align-top">
                          <span className="inline-flex rounded-full bg-slate-100 text-slate-700 px-3 py-1 text-xs">
                            {prettyTipo(d.tipo, r.accion)}
                          </span>
                        </td>
                        <td className="py-4 px-4 align-top">
                          <p className="text-xs sm:text-sm text-slate-800 leading-relaxed">
                            {formatDetalle(d)}
                          </p>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* paginación */}
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-t text-xs text-slate-600">
              <div>
                Mostrando{" "}
                {total === 0
                  ? "0"
                  : `${page * PAGE_SIZE + 1}–${
                      page * PAGE_SIZE + visibleRows.length
                    }`}{" "}
                de {total}
              </div>
              <div className="flex gap-2">
                <Button
                  color="light"
                  size="xs"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={!canPrev}
                >
                  Anterior
                </Button>
                <Button
                  color="light"
                  size="xs"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={!canNext}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
