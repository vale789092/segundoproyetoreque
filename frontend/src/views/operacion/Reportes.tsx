// src/reportes/Reportes.tsx
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Tabs, Card, Button, Label, TextInput, Select, Table } from "flowbite-react";

import {
  getUsoGlobal,
  downloadUsoGlobalXlsx,
  downloadUsoGlobalPdf,
  getInventario,
  downloadInventarioXlsx,
  getMyUsage,
  downloadMyUsageXlsx,
  downloadMyUsagePdf,
  type UsoGlobalRow,
  type InventarioRow,
  type MyUsageRow,
} from "@/services/reportes";

type Mode = "resumen" | "global" | "inventario";

function downloadBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

const formatFechaHora = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("es-CR", {
    dateStyle: "short",
    timeStyle: "short",
  });
};

const prettyEvento = (evt: string) =>
  evt
    .replace(/_/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase());

export default function Reportes() {
  const { pathname } = useLocation();
  const nav = useNavigate();

  // 1) Derivar modo desde la URL
  const pathMode: Mode = useMemo(() => {
    if (pathname.includes("/uso-global")) return "global";
    if (pathname.includes("/inventario")) return "inventario";
    return "resumen";
  }, [pathname]);

  const [mode, setMode] = useState<Mode>(pathMode);
  useEffect(() => setMode(pathMode), [pathMode]);

  const modeToIndex: Record<Mode, number> = { resumen: 0, global: 1, inventario: 2 };
  const indexToMode = (i: number): Mode =>
    (["resumen", "global", "inventario"][i] as Mode);

  const go = (m: Mode) => {
    if (m === "resumen") nav("/app/reportes");
    if (m === "global") nav("/app/reportes/uso-global");
    if (m === "inventario") nav("/app/reportes/inventario");
  };

  // filtros comunes
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [tipo, setTipo] = useState<"all" | "solicitudes" | "uso" | "devolucion">("all");

  // estado de datos
  const [myRows, setMyRows] = useState<MyUsageRow[]>([]);
  const [globalRows, setGlobalRows] = useState<UsoGlobalRow[]>([]);
  const [inventarioRows, setInventarioRows] = useState<InventarioRow[]>([]);

  const [loadingMy, setLoadingMy] = useState(false);
  const [loadingGlobal, setLoadingGlobal] = useState(false);
  const [loadingInventario, setLoadingInventario] = useState(false);

  const [downMyXlsx, setDownMyXlsx] = useState(false);
  const [downMyPdf, setDownMyPdf] = useState(false);
  const [downGlobalXlsx, setDownGlobalXlsx] = useState(false);
  const [downGlobalPdf, setDownGlobalPdf] = useState(false);
  const [downInventarioXlsx, setDownInventarioXlsx] = useState(false);

  // Rango por defecto: “todo lo posible”
  const DEFAULT_FROM_ALL = "2000-01-01";
  const todayStr = new Date().toISOString().slice(0, 10);

  const buildMyUsageParams = () => {
    const params: {
      from?: string;
      to?: string;
      tipo?: "all" | "solicitudes" | "uso" | "devolucion";
    } = {};

    // Si NO hay fechas elegidas, pedimos TODO el historial
    if (!from && !to) {
      params.from = DEFAULT_FROM_ALL;
      params.to = todayStr;
    } else {
      if (from) params.from = from;
      if (to) params.to = to;
    }

    // siempre mandamos tipo (tiene valor por defecto "all")
    params.tipo = tipo;

    return params;
  };

  const buildGlobalParams = () => {
    const params: { from?: string; to?: string } = {};

    // Igual lógica: sin filtros → todo el historial
    if (!from && !to) {
      params.from = DEFAULT_FROM_ALL;
      params.to = todayStr;
    } else {
      if (from) params.from = from;
      if (to) params.to = to;
    }

    return params;
  };


  // --------- RESUMEN: cargar bitácora personal ---------
  const handleFetchMyUsage = async () => {
    try {
      setLoadingMy(true);
      const data = await getMyUsage(buildMyUsageParams());
      setMyRows(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMy(false);
    }
  };

  // --------- USO GLOBAL ---------
  const handleFetchGlobal = async () => {
    try {
      setLoadingGlobal(true);
      const data = await getUsoGlobal(buildGlobalParams());
      setGlobalRows(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingGlobal(false);
    }
  };

  // --------- INVENTARIO ---------
  const handleFetchInventario = async () => {
    try {
      setLoadingInventario(true);
      const data = await getInventario();
      setInventarioRows(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingInventario(false);
    }
  };

  // Disparar fetch automático al entrar en cada tab
  useEffect(() => {
    if (mode === "resumen") handleFetchMyUsage();
    if (mode === "global") handleFetchGlobal();
    if (mode === "inventario") handleFetchInventario();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // --------- Descargas RESUMEN ---------
  const handleDownloadMyXlsx = async () => {
    try {
      setDownMyXlsx(true);
      const blob = await downloadMyUsageXlsx(buildMyUsageParams());
      const fname = `HistorialUso_${from || "na"}-a-${to || "na"}_${tipo}.xlsx`;
      downloadBlob(blob, fname);
    } catch (err) {
      console.error(err);
    } finally {
      setDownMyXlsx(false);
    }
  };

  const handleViewMyPdf = async () => {
    try {
      setDownMyPdf(true);
      const blob = await downloadMyUsagePdf(buildMyUsageParams());
      const url = window.URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch (err) {
      console.error(err);
    } finally {
      setDownMyPdf(false);
    }
  };

  // --------- Descargas USO GLOBAL ---------
  const handleDownloadGlobalXlsx = async () => {
    try {
      setDownGlobalXlsx(true);
      const blob = await downloadUsoGlobalXlsx(buildGlobalParams());
      downloadBlob(
        blob,
        `UsoGlobal_${from || "na"}-a-${to || "na"}.xlsx`
      );
    } catch (err) {
      console.error(err);
    } finally {
      setDownGlobalXlsx(false);
    }
  };

  const handleViewGlobalPdf = async () => {
    try {
      setDownGlobalPdf(true);
      const blob = await downloadUsoGlobalPdf(buildGlobalParams());
      const url = window.URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch (err) {
      console.error(err);
    } finally {
      setDownGlobalPdf(false);
    }
  };

  // --------- Descargas INVENTARIO ---------
  const handleDownloadInventarioXlsx = async () => {
    try {
      setDownInventarioXlsx(true);
      const blob = await downloadInventarioXlsx();
      downloadBlob(blob, "InventarioInstitucional.xlsx");
    } catch (err) {
      console.error(err);
    } finally {
      setDownInventarioXlsx(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-semibold">Reportes institucionales</h2>

      <Tabs
        key={mode}
        aria-label="tabs-reportes"
        onActiveTabChange={(i) => go(indexToMode(i))}
      >
        <Tabs.Item title="Resumen" active={mode === "resumen"} />
        <Tabs.Item title="Uso global" active={mode === "global"} />
        <Tabs.Item title="Inventario" active={mode === "inventario"} />
      </Tabs>

      <Card>
  <div className="flex flex-wrap items-end gap-4">
    <div>
      <Label htmlFor="from" value="Desde" />
      <TextInput
        id="from"
        type="date"
        value={from}
        onChange={(e) => setFrom(e.target.value)}
      />
    </div>
    <div>
      <Label htmlFor="to" value="Hasta" />
      <TextInput
        id="to"
        type="date"
        value={to}
        onChange={(e) => setTo(e.target.value)}
      />
    </div>

{/* === Controles RESUMEN === */}
{mode === "resumen" && (
  <div className="flex flex-wrap items-end gap-3">
    <div>
      <Label htmlFor="tipo" value="Tipo" />
      <Select
        id="tipo"
        value={tipo}
        onChange={(e) => setTipo(e.target.value as any)}
      >
        <option value="all">Todo</option>
        <option value="solicitudes">Solicitudes</option>
        <option value="uso">Uso</option>
        <option value="devolucion">Devoluciones</option>
      </Select>
    </div>

    <Button
      color="light"
      onClick={handleFetchMyUsage}
      isProcessing={loadingMy}
    >
      Actualizar
    </Button>
    <Button
      color="light"
      onClick={handleDownloadMyXlsx}
      isProcessing={downMyXlsx}
    >
      Descargar XLSX
    </Button>
    <Button
      color="light"
      onClick={handleViewMyPdf}
      isProcessing={downMyPdf}
    >
      Ver PDF
    </Button>
  </div>
)}



{/* === Controles USO GLOBAL === */}
{mode === "global" && (
  <div className="flex flex-wrap items-end gap-3">
    <Button
      color="light"
      onClick={handleFetchGlobal}
      isProcessing={loadingGlobal}
    >
      Actualizar
    </Button>
    <Button
      color="light"
      onClick={handleDownloadGlobalXlsx}
      isProcessing={downGlobalXlsx}
    >
      Descargar XLSX
    </Button>
    <Button
      color="light"
      onClick={handleViewGlobalPdf}
      isProcessing={downGlobalPdf}
    >
      Ver PDF
    </Button>
  </div>
)}

{/* === Controles INVENTARIO === */}
{mode === "inventario" && (
  <div className="flex flex-wrap items-end gap-3">
    <Button
      color="light"
      onClick={handleDownloadInventarioXlsx}
      isProcessing={downInventarioXlsx}
    >
      Descargar XLSX
    </Button>
  </div>
)}

  </div>
</Card>


      {/* RESUMEN (bitácora personal) */}
      {mode === "resumen" && (
        <Card>
          <p className="text-sm text-gray-500 mb-2">
            Bitácora personal de uso (GET <code>/history/my-usage</code>) filtrada por
            fecha y tipo de evento.
          </p>
          <Table>
            <Table.Head>
              <Table.HeadCell>Solicitud</Table.HeadCell>
              <Table.HeadCell>Evento</Table.HeadCell>
              <Table.HeadCell>Fecha/Hora</Table.HeadCell>
              <Table.HeadCell>Estado</Table.HeadCell>
              <Table.HeadCell>Laboratorio</Table.HeadCell>
              <Table.HeadCell>Recurso</Table.HeadCell>
            </Table.Head>
            <Table.Body className="divide-y">
              {myRows.map((r) => (
                <Table.Row
                  key={`${r.solicitud_id}-${r.tipo_evento}-${r.ts}`}
                >
                  <Table.Cell>{r.solicitud_id || "—"}</Table.Cell>
                  <Table.Cell>{prettyEvento(r.tipo_evento)}</Table.Cell>
                  <Table.Cell>{formatFechaHora(r.ts)}</Table.Cell>
                  <Table.Cell>{r.estado || "—"}</Table.Cell>
                  <Table.Cell>
                    {r.laboratorio
                      ? `${r.laboratorio.nombre ?? ""} (${r.laboratorio.id ?? ""})`
                      : "—"}
                  </Table.Cell>
                  <Table.Cell>
                    {r.recurso
                      ? `${r.recurso.nombre ?? ""} (${r.recurso.id ?? ""})`
                      : "—"}
                  </Table.Cell>
                </Table.Row>
              ))}
              {!loadingMy && myRows.length === 0 && (
                <Table.Row>
                  <Table.Cell colSpan={6} className="text-center text-sm">
                    Sin eventos para el rango seleccionado.
                  </Table.Cell>
                </Table.Row>
              )}
            </Table.Body>
          </Table>
        </Card>
      )}

      {/* USO GLOBAL */}
      {mode === "global" && (
        <Card>
          <p className="text-sm text-gray-500 mb-2">
            Reporte de uso global (reservas/préstamos/mantenimientos por
            periodo académico).
          </p>
          <Table>
            <Table.Head>
              <Table.HeadCell>Periodo</Table.HeadCell>
              <Table.HeadCell>Reservas</Table.HeadCell>
              <Table.HeadCell>Préstamos</Table.HeadCell>
              <Table.HeadCell>Mantenimientos</Table.HeadCell>
            </Table.Head>
            <Table.Body className="divide-y">
              {globalRows.map((r) => (
                <Table.Row key={r.periodo}>
                  <Table.Cell>{r.periodo}</Table.Cell>
                  <Table.Cell>{r.reservas}</Table.Cell>
                  <Table.Cell>{r.prestamos}</Table.Cell>
                  <Table.Cell>{r.mantenimientos}</Table.Cell>
                </Table.Row>
              ))}
              {!loadingGlobal && globalRows.length === 0 && (
                <Table.Row>
                  <Table.Cell colSpan={4} className="text-center text-sm">
                    Sin datos para el rango seleccionado.
                  </Table.Cell>
                </Table.Row>
              )}
            </Table.Body>
          </Table>
        </Card>
      )}

      {/* INVENTARIO */}
      {mode === "inventario" && (
        <Card>
          <p className="text-sm text-gray-500 mb-2">
            Inventario institucional (estado y ubicación de todos los recursos).
          </p>
          <Table>
            <Table.Head>
              <Table.HeadCell>Lab</Table.HeadCell>
              <Table.HeadCell>Recurso</Table.HeadCell>
              <Table.HeadCell>Estado</Table.HeadCell>
              <Table.HeadCell>Ubicación</Table.HeadCell>
            </Table.Head>
            <Table.Body className="divide-y">
              {inventarioRows.map((r) => (
                <Table.Row key={`${r.lab_id}-${r.recurso_id}`}>
                  <Table.Cell>
                    {r.lab_nombre} ({r.lab_id})
                  </Table.Cell>
                  <Table.Cell>
                    {r.recurso_nombre} ({r.recurso_id})
                  </Table.Cell>
                  <Table.Cell>{r.estado}</Table.Cell>
                  <Table.Cell>{r.ubicacion}</Table.Cell>
                </Table.Row>
              ))}
              {!loadingInventario && inventarioRows.length === 0 && (
                <Table.Row>
                  <Table.Cell colSpan={4} className="text-center text-sm">
                    Sin datos de inventario.
                  </Table.Cell>
                </Table.Row>
              )}
            </Table.Body>
          </Table>
        </Card>
      )}
    </div>
  );
}
