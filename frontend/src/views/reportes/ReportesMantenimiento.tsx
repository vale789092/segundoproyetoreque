// src/views/reportes/ReportesMantenimiento.tsx
import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, Label, Select, TextInput } from "flowbite-react";
import { Icon } from "@iconify/react";
import { listLabs, type LabRow } from "@/services/labs";
import {
  MantTipo,
  MantGroup,
  type MantEquipoRow,
  type MantLabRow,
  getMantReport,
  exportMantPdf,
  exportMantXlsx,
} from "@/services/reportesmant";

const TIPOS: (MantTipo | "")[] = [
  "",
  "preventivo",
  "correctivo",
  "calibracion",
  "inspeccion",
  "otro",
];

export default function ReportesMantenimiento() {
  /* Filtros */
  const [labs, setLabs] = useState<LabRow[]>([]);
  const [labId, setLabId] = useState<string>("");
  const [tipo, setTipo] = useState<MantTipo | "">("");
  const [group, setGroup] = useState<MantGroup>("equipo");

  // Rango por defecto: últimos 90 días hasta hoy
  const today = new Date();
  const defTo = today.toISOString().slice(0, 10);
  const defFrom = new Date(today.getTime() - 90 * 24 * 3600 * 1000)
    .toISOString()
    .slice(0, 10);

  const [from, setFrom] = useState<string>(defFrom);
  const [to, setTo] = useState<string>(defTo);

  /* Estado */
  const [loading, setLoading] = useState(false);
  const [rowsEq, setRowsEq] = useState<MantEquipoRow[]>([]);
  const [rowsLab, setRowsLab] = useState<MantLabRow[]>([]);

  /* Cargar labs */
  useEffect(() => {
    (async () => {
      try {
        const ls = await listLabs();
        setLabs(ls);
        if (!labId && ls[0]) setLabId(ls[0].id);
      } catch {
        setLabs([]);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const params = useMemo(
    () => ({
      labId: labId || undefined,
      desde: from,
      hasta: to,
      tipo: tipo || undefined,
      group,
    }),
    [labId, from, to, tipo, group]
  );

  async function handlePreview() {
    setLoading(true);
    try {
      const data = await getMantReport(params);
      if (group === "lab") {
        setRowsLab(data as MantLabRow[]);
        setRowsEq([]);
      } else {
        setRowsEq(data as MantEquipoRow[]);
        setRowsLab([]);
      }
    } catch (e: any) {
      alert(e?.message ?? "No se pudo cargar el reporte");
      setRowsEq([]);
      setRowsLab([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleExport(fmt: "xlsx" | "pdf") {
    try {
      if (fmt === "xlsx") await exportMantXlsx(params);
      else await exportMantPdf(params);
    } catch (e: any) {
      alert(e?.message ?? "No se pudo exportar");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Reportes de Mantenimiento</h2>
      </div>

      <Card>
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 md:col-span-4">
            <Label value="Laboratorio" />
            <Select value={labId} onChange={(e) => setLabId(e.target.value)}>
              {labs.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nombre} — {l.ubicacion}
                </option>
              ))}
              <option value="">Todos</option>
            </Select>
          </div>

          <div className="col-span-6 md:col-span-2">
            <Label value="Desde" />
            <TextInput
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div className="col-span-6 md:col-span-2">
            <Label value="Hasta" />
            <TextInput
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>

          <div className="col-span-6 md:col-span-2">
            <Label value="Tipo" />
            <Select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as MantTipo | "")}
            >
              {TIPOS.map((t) => (
                <option key={t || "todos"} value={t}>
                  {t ? t : "Todos"}
                </option>
              ))}
            </Select>
          </div>

          <div className="col-span-6 md:col-span-2">
            <Label value="Agrupar por" />
            <Select
              value={group}
              onChange={(e) => setGroup(e.target.value as MantGroup)}
            >
              <option value="equipo">Equipo</option>
              <option value="lab">Laboratorio</option>
            </Select>
          </div>

          <div className="col-span-12 flex flex-wrap gap-3 justify-end">
            <Button color="light" onClick={handlePreview} isProcessing={loading}>
              <Icon icon="solar:eye-linear" className="me-2" />
              Ver
            </Button>
            <Button onClick={() => handleExport("xlsx")}>
              <Icon icon="solar:document-linear" className="me-2" />
              Exportar XLSX
            </Button>
            <Button color="dark" onClick={() => handleExport("pdf")}>
              <Icon icon="solar:file-pdf-linear" className="me-2" />
              Exportar PDF
            </Button>
          </div>
        </div>
      </Card>

      {/* Preview simple */}
      {group === "lab" ? (
        rowsLab.length > 0 && (
          <Card>
            <div className="overflow-x-auto">
              <table className="min-w-[800px] w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="py-2 pe-3">Laboratorio</th>
                    <th className="py-2 pe-3">Equipos</th>
                    <th className="py-2 pe-3">Mantenimientos</th>
                    <th className="py-2 pe-3">Downtime (h)</th>
                    <th className="py-2 pe-3">Prom. por mant (h)</th>
                  </tr>
                </thead>
                <tbody>
                  {rowsLab.map((r, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-2 pe-3">{r.lab.nombre}</td>
                      <td className="py-2 pe-3">{r.equipos}</td>
                      <td className="py-2 pe-3">{r.mantenimientos}</td>
                      <td className="py-2 pe-3">
                        {r.downtime_hours.toFixed(2)}
                      </td>
                      <td className="py-2 pe-3">
                        {r.avg_downtime_hours.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )
      ) : (
        rowsEq.length > 0 && (
          <Card>
            <div className="overflow-x-auto">
              <table className="min-w-[1000px] w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="py-2 pe-3">Lab</th>
                    <th className="py-2 pe-3">Equipo</th>
                    <th className="py-2 pe-3">Código</th>
                    <th className="py-2 pe-3">Mants</th>
                    <th className="py-2 pe-3">Down (h)</th>
                    <th className="py-2 pe-3">Prom (h)</th>
                    <th className="py-2 pe-3">Primero</th>
                    <th className="py-2 pe-3">Último</th>
                  </tr>
                </thead>
                <tbody>
                  {rowsEq.map((r, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-2 pe-3">{r.lab.nombre}</td>
                      <td className="py-2 pe-3">{r.equipo.nombre}</td>
                      <td className="py-2 pe-3">{r.equipo.codigo}</td>
                      <td className="py-2 pe-3">{r.mantenimientos}</td>
                      <td className="py-2 pe-3">
                        {r.downtime_hours.toFixed(2)}
                      </td>
                      <td className="py-2 pe-3">
                        {r.avg_downtime_hours.toFixed(2)}
                      </td>
                      <td className="py-2 pe-3">
                        {r.primero_en_rango
                          ? new Date(r.primero_en_rango).toLocaleString()
                          : "-"}
                      </td>
                      <td className="py-2 pe-3">
                        {r.ultimo_en_rango
                          ? new Date(r.ultimo_en_rango).toLocaleString()
                          : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-2 text-xs text-slate-500 flex items-center gap-2">
              <Badge color="info">Vista previa</Badge>
              Usa los botones de arriba para exportar el mismo rango y filtros.
            </div>
          </Card>
        )
      )}
    </div>
  );
}
