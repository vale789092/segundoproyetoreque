import { useEffect, useMemo, useState } from "react";
import { Button, Card, Select, TextInput } from "flowbite-react";
import { listMyHistory, MyHistoryRow } from "@/services/history";
import { exportJsonToXlsx } from "@/utilidad/exportXlsx";

function toDateInputValue(d: Date) {
  // yyyy-mm-dd
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}

export default function MyHistory() {
  const [desde, setDesde] = useState<string>(() => toDateInputValue(new Date(Date.now() - 30*86400000)));
  const [hasta, setHasta] = useState<string>(() => toDateInputValue(new Date()));
  const [tipo, setTipo] = useState<string>("");
  const [rows, setRows] = useState<MyHistoryRow[]>([]);
  const [loading, setLoading] = useState(false);

  async function fetchData() {
    setLoading(true);
    try {
      const data = await listMyHistory({
        desde: desde ? new Date(desde).toISOString() : undefined,
        hasta: hasta ? new Date(new Date(hasta).getTime()+24*60*60*1000).toISOString() : undefined, // exclusivo
        tipo: tipo || undefined,
      });
      setRows(data);
    } finally { setLoading(false); }
  }

  useEffect(() => { fetchData(); }, []); // carga inicial

  const flatRows = useMemo(() => rows.map(r => ({
    id: r.id,
    fecha: new Date(r.creado_en).toLocaleString(),
    laboratorio: r.lab_nombre,
    accion: r.accion,
    // puedes “aplanar” detalle si viene con campos comunes:
    detalle: JSON.stringify(r.detalle ?? {}),
  })), [rows]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Mi historial</h3>
        <div className="flex gap-2">
          <Button color="light" onClick={fetchData} isProcessing={loading}>Refrescar</Button>
          <Button className="bg-primary text-white" onClick={() => exportJsonToXlsx(flatRows, "mi_historial.xlsx")} disabled={!rows.length}>
            Exportar a Excel
          </Button>
        </div>
      </div>

      <Card>
        {/* Filtros */}
        <div className="grid sm:grid-cols-4 gap-3">
          <div>
            <label className="text-sm font-medium">Desde</label>
            <TextInput type="date" value={desde} onChange={e => setDesde(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium">Hasta</label>
            <TextInput type="date" value={hasta} onChange={e => setHasta(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium">Tipo</label>
            <Select value={tipo} onChange={e => setTipo(e.target.value)}>
              <option value="">Todos</option>
              <option value="reserva">Reservas</option>
              <option value="prestamo">Préstamos</option>
              <option value="devolucion">Devoluciones</option>
              <option value="capacitacion">Capacitaciones</option>
              <option value="otro">Otros</option>
            </Select>
          </div>
          <div className="flex items-end">
            <Button onClick={fetchData} isProcessing={loading} className="w-full bg-primary text-white">Aplicar</Button>
          </div>
        </div>
      </Card>

      <Card>
        {loading ? <p>Cargando…</p> :
          rows.length === 0 ? <p className="text-sm text-slate-500">No hay eventos para el filtro seleccionado.</p> :
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="py-2 pr-4">Fecha</th>
                  <th className="py-2 pr-4">Laboratorio</th>
                  <th className="py-2 pr-4">Acción</th>
                  <th className="py-2">Detalle</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} className="border-t">
                    <td className="py-2 pr-4">{new Date(r.creado_en).toLocaleString()}</td>
                    <td className="py-2 pr-4">{r.lab_nombre}</td>
                    <td className="py-2 pr-4">{r.accion}</td>
                    <td className="py-2">
                      <code className="text-xs">{JSON.stringify(r.detalle ?? {}, null, 0)}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        }
      </Card>
    </div>
  );
}
