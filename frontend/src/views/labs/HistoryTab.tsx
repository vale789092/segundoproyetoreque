import React from "react";
import { Button, Badge, Card } from "flowbite-react";
import { Loader2, Search, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { listLabHistory, type LabHistoryRow } from "@/services/labs";

type Props = { labId: string };

const PAGE_SIZE = 15;

function fmt(dateIso?: string) {
  if (!dateIso) return "—";
  const d = new Date(dateIso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

export default function HistoryTab({ labId }: Props) {
  const [rows, setRows] = React.useState<LabHistoryRow[]>([]);
  const [total, setTotal] = React.useState<number | undefined>(undefined);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);

  // filtros
  const [accion, setAccion] = React.useState<string>("");  // texto libre o lista separada por comas
  const [tipo, setTipo] = React.useState<string>("");
  const [q, setQ] = React.useState<string>("");
  const [desde, setDesde] = React.useState<string>("");
  const [hasta, setHasta] = React.useState<string>("");

  // paginación
  const [offset, setOffset] = React.useState(0);
  const limit = PAGE_SIZE;

  const canPrev = offset > 0;
  const canNext = typeof total === "number" ? offset + limit < total : rows.length === limit; // fallback

  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true);
      setErr(null);
      const { rows, total } = await listLabHistory(labId, {
        accion: accion.trim() ? accion.split(",").map(s => s.trim()).filter(Boolean) : undefined,
        tipo: tipo || undefined,
        q: q || undefined,
        desde: desde || undefined,
        hasta: hasta || undefined,
        limit,
        offset,
      });
      setRows(rows || []);
      setTotal(total);
    } catch (e: any) {
      setErr(e?.response?.data?.error?.message ?? e?.message ?? "Error al cargar historial");
      setRows([]);
      setTotal(undefined);
    } finally {
      setLoading(false);
    }
  }, [labId, accion, tipo, q, desde, hasta, limit, offset]);

  React.useEffect(() => { fetchData(); }, [fetchData]);

  function resetAndSearch(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setOffset(0);
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
              placeholder="ej: horario, equipo"
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
            <Button color="light" type="button" onClick={() => { setAccion(""); setTipo(""); setQ(""); setDesde(""); setHasta(""); setOffset(0); }}>
              Limpiar
            </Button>
            <Button onClick={resetAndSearch}>
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
        ) : rows.length === 0 ? (
          <div className="p-6 text-sm opacity-70">Sin eventos que coincidan con los filtros.</div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-white/5">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Fecha</th>
                <th className="px-4 py-3 text-left font-medium">Acción</th>
                <th className="px-4 py-3 text-left font-medium">Tipo</th>
                <th className="px-4 py-3 text-left font-medium">Detalle</th>
                <th className="px-4 py-3 text-left font-medium">Usuario</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-4 py-3 whitespace-nowrap">{fmt(r.creado_en)}</td>
                  <td className="px-4 py-3">
                    <Badge color="indigo">{r.accion || "—"}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    {r.tipo ? <Badge color={r.tipo === "horario" ? "blue" : r.tipo === "equipo" ? "green" : "gray"}>{r.tipo}</Badge> : "—"}
                  </td>
                  <td className="px-4 py-3 max-w-[420px]">
                    <pre className="text-xs whitespace-pre-wrap break-words opacity-90">
                      {typeof r.detalle === "object" ? JSON.stringify(r.detalle, null, 0) : (r.detalle ?? "—")}
                    </pre>
                  </td>
                  <td className="px-4 py-3">
                    {r.usuario_nombre ? <span className="font-medium">{r.usuario_nombre}</span> : "—"}
                    {r.usuario_correo ? <div className="text-xs opacity-70">{r.usuario_correo}</div> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Paginación */}
        {!loading && rows.length > 0 && (
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-t text-sm">
            <div className="opacity-70">
              {typeof total === "number"
                ? `Mostrando ${offset + 1}–${Math.min(offset + rows.length, total)} de ${total}`
                : `Mostrando ${rows.length} registros`}
            </div>
            <div className="flex items-center gap-2">
              <Button color="light" size="xs" onClick={() => setOffset(Math.max(0, offset - limit))} disabled={!canPrev}>
                <ChevronLeft className="h-4 w-4" /> Anterior
              </Button>
              <Button color="light" size="xs" onClick={() => setOffset(offset + limit)} disabled={!canNext}>
                Siguiente <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
