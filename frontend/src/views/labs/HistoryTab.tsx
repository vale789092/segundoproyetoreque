import React from "react";
import { Button, Badge, Card } from "flowbite-react";
import {
  Loader2,
  Search,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { listLabHistory, type LabHistoryRow } from "@/services/labs";

type Props = { labId: string };

const PAGE_SIZE = 10;

function fmt(dateIso?: string) {
  if (!dateIso) return "—";
  const d = new Date(dateIso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

// Deducción de tipo cuando viene vacío
function getTipoForRow(r: LabHistoryRow): string | null {
  if (r.tipo) return r.tipo;

  const accion = r.accion || "";
  if (accion.includes("equipo")) return "equipo";
  if (accion.includes("reserva")) return "reserva";
  if (accion.includes("horario")) return "horario";
  if (accion.includes("lab")) return "lab";

  return null;
}

function TipoBadge({ row }: { row: LabHistoryRow }) {
  const tipo = getTipoForRow(row);
  if (!tipo) return <span className="text-xs text-slate-400">—</span>;

  const color =
    tipo === "horario"
      ? "blue"
      : tipo === "equipo"
      ? "green"
      : tipo === "reserva"
      ? "yellow"
      : "gray";

  return (
    <Badge color={color} className="capitalize">
      {tipo}
    </Badge>
  );
}

// Resumen legible para admin
function buildSummary(row: LabHistoryRow): string | null {
  const d = row.detalle as any;
  if (!d || typeof d !== "object") return null;

  if (row.accion === "cambio_estado_equipo" && d.patch?.estado_disp) {
    const from =
      d.prev?.estado_disp || d.estado_anterior || d.before?.estado_disp || "?";
    const to = d.patch.estado_disp;
    return `Estado del equipo: ${from} → ${to}`;
  }

  if (row.accion === "reserva_aprobada" || row.accion === "reserva_rechazada") {
    const id = d.solicitud_id ?? d.reserva_id ?? "";
    const status = row.accion === "reserva_aprobada" ? "aprobada" : "rechazada";
    return `Reserva ${id ? `#${id} ` : ""}${status}`;
  }

  if (row.accion === "reserva_creada") {
    const id = d.solicitud_id ?? d.reserva_id ?? "";
    return `Reserva creada${id ? ` (#${id})` : ""}`;
  }

  if (row.accion === "actualizacion_lab") {
    return "Actualización de datos del laboratorio / técnicos responsables";
  }

  return null;
}

function DetalleBox({ row }: { row: LabHistoryRow }) {
  const detalle = row.detalle as any;
  const summary = buildSummary(row);

  if (!detalle && !summary) {
    return <span className="text-xs text-slate-400">—</span>;
  }

  let text: string;
  if (typeof detalle === "string") {
    text = detalle;
  } else {
    try {
      text = JSON.stringify(detalle, null, 2);
    } catch {
      text = String(detalle);
    }
  }

  return (
    <div className="space-y-1">
      {summary && (
        <p className="text-xs font-medium text-slate-800 dark:text-slate-100">
          {summary}
        </p>
      )}
      <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-white/10 rounded-xl px-3 py-2 max-h-32 overflow-auto">
        <pre className="font-mono text-[11px] leading-snug whitespace-pre-wrap break-words opacity-90">
          {text}
        </pre>
      </div>
    </div>
  );
}

export default function HistoryTab({ labId }: Props) {
  const [rows, setRows] = React.useState<LabHistoryRow[]>([]);
  const [total, setTotal] = React.useState<number>(0);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);

  // filtros
  const [accion, setAccion] = React.useState<string>("");
  const [tipo, setTipo] = React.useState<string>("");
  const [q, setQ] = React.useState<string>("");
  const [desde, setDesde] = React.useState<string>("");
  const [hasta, setHasta] = React.useState<string>("");

  // paginación (client-side)
  const [page, setPage] = React.useState(0); // 0-based

  const paginatedRows = React.useMemo(
    () =>
      rows.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE),
    [rows, page]
  );

  const canPrev = page > 0;
  const canNext = (page + 1) * PAGE_SIZE < total;

  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true);
      setErr(null);
      // Pedimos TODO el historial con filtros (sin limit/offset)
      const { rows, total } = await listLabHistory(labId, {
        accion: accion.trim()
          ? accion
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : undefined,
        tipo: tipo || undefined,
        q: q || undefined,
        desde: desde || undefined,
        hasta: hasta || undefined,
      });

      const allRows = rows || [];
      setRows(allRows);
      setTotal(typeof total === "number" ? total : allRows.length);
      setPage(0); // cada búsqueda vuelve a página 1
    } catch (e: any) {
      setErr(
        e?.response?.data?.error?.message ??
          e?.message ??
          "Error al cargar historial"
      );
      setRows([]);
      setTotal(0);
      setPage(0);
    } finally {
      setLoading(false);
    }
  }, [labId, accion, tipo, q, desde, hasta]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  function resetAndSearch(e?: React.FormEvent) {
    if (e) e.preventDefault();
    fetchData();
  }

  return (
    <div className="space-y-3">
      {/* Filtros */}
      <Card className="rounded-2xl">
        <form onSubmit={resetAndSearch} className="grid gap-3 md:grid-cols-12">
          <div className="md:col-span-3">
            <label className="block text-sm mb-1">Acción (a,b,c)</label>
            <input
              value={accion}
              onChange={(e) => setAccion(e.target.value)}
              placeholder="ej: actualizacion_lab,reserva_creada"
              className="w-full rounded-xl border px-3 py-2 text-sm bg-transparent"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm mb-1">Tipo</label>
            <input
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              placeholder="ej: horario, equipo, reserva"
              className="w-full rounded-xl border px-3 py-2 text-sm bg-transparent"
            />
          </div>
          <div className="md:col-span-3">
            <label className="block text-sm mb-1">Buscar</label>
            <div className="flex rounded-xl border">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="usuario, código, texto…"
                className="w-full bg-transparent px-3 py-2 text-sm outline-none"
              />
              <button type="submit" className="px-3">
                <Search className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm mb-1">Desde</label>
            <input
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              className="w-full rounded-xl border px-3 py-2 text-sm bg-transparent"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm mb-1">Hasta</label>
            <input
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              className="w-full rounded-xl border px-3 py-2 text-sm bg-transparent"
            />
          </div>
          <div className="md:col-span-12 flex items-center justify-end gap-2">
            <Button
              color="light"
              type="button"
              onClick={() => {
                setAccion("");
                setTipo("");
                setQ("");
                setDesde("");
                setHasta("");
                setPage(0);
              }}
            >
              Limpiar
            </Button>
            <Button type="submit">
              <Search className="mr-2 h-4 w-4" /> Buscar
            </Button>
            <Button color="light" onClick={fetchData} type="button">
              <RefreshCw className="mr-2 h-4 w-4" /> Refrescar
            </Button>
          </div>
        </form>
      </Card>

      {/* Tabla */}
      <div className="overflow-x-auto rounded-2xl border bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100">
        {loading ? (
          <div className="p-4 text-sm flex items-center gap-2 opacity-80">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
          </div>
        ) : err ? (
          <div className="p-4 text-sm text-red-600">{err}</div>
        ) : paginatedRows.length === 0 ? (
          <div className="p-6 text-sm opacity-70">
            Sin eventos que coincidan con los filtros.
          </div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-white/5">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Fecha</th>
                <th className="px-4 py-3 text-left font-medium">Acción</th>
                <th className="px-4 py-3 text-left font-medium">Tipo</th>
                <th className="px-4 py-3 text-left font-medium">
                  Detalle / cambios
                </th>
                <th className="px-4 py-3 text-left font-medium">Usuario</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRows.map((r) => (
                <tr key={r.id} className="border-t align-top">
                  <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-600">
                    {fmt(r.creado_en)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge color="indigo" className="font-medium">
                      {r.accion || "—"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <TipoBadge row={r} />
                  </td>
                  <td className="px-4 py-3 max-w-[420px]">
                    <DetalleBox row={r} />
                  </td>
                  <td className="px-4 py-3">
                    {r.usuario_nombre ? (
                      <span className="font-medium">{r.usuario_nombre}</span>
                    ) : (
                      "—"
                    )}
                    {r.usuario_correo && (
                      <div className="text-xs opacity-70">
                        {r.usuario_correo}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Paginación */}
        {!loading && paginatedRows.length > 0 && (
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-t text-sm">
            <div className="opacity-70">
              {total > 0
                ? `Mostrando ${
                    total === 0 ? 0 : page * PAGE_SIZE + 1
                  }–${Math.min((page + 1) * PAGE_SIZE, total)} de ${total}`
                : `Mostrando ${paginatedRows.length} registros`}
            </div>
            <div className="flex items-center gap-2">
              <Button
                color="light"
                size="xs"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={!canPrev}
              >
                <ChevronLeft className="h-4 w-4" /> Anterior
              </Button>
              <Button
                color="light"
                size="xs"
                onClick={() => setPage((p) => p + 1)}
                disabled={!canNext}
              >
                Siguiente <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
