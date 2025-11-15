// src/reportes/Reportes.tsx (o donde lo tengas)
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Tabs, Card, Button, Label, TextInput, Select, Table } from "flowbite-react";

import {
  getUsoGlobal,
  downloadUsoGlobalXlsx,
  downloadUsoGlobalPdf,
  getInventario,
  downloadInventarioXlsx,
  type UsoGlobalRow,
  type InventarioRow,
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

  // filtros
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [tipo, setTipo] = useState<"all" | "solicitudes" | "uso" | "devolucion">("all");

  // estado de datos
  const [globalRows, setGlobalRows] = useState<UsoGlobalRow[]>([]);
  const [inventarioRows, setInventarioRows] = useState<InventarioRow[]>([]);

  const [loadingGlobal, setLoadingGlobal] = useState(false);
  const [loadingInventario, setLoadingInventario] = useState(false);
  const [downGlobalXlsx, setDownGlobalXlsx] = useState(false);
  const [downGlobalPdf, setDownGlobalPdf] = useState(false);
  const [downInventarioXlsx, setDownInventarioXlsx] = useState(false);

  // Cargar datos de uso global cuando se está en esa pestaña y cambian filtros
  const handleFetchGlobal = async () => {
    try {
      setLoadingGlobal(true);
      const data = await getUsoGlobal({ from, to });
      setGlobalRows(data);
    } catch (err) {
      console.error(err);
      // aquí podrías mostrar toast/error
    } finally {
      setLoadingGlobal(false);
    }
  };

  // Cargar inventario
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
    if (mode === "global") handleFetchGlobal();
    if (mode === "inventario") handleFetchInventario();
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Descargas
  const handleDownloadGlobalXlsx = async () => {
    try {
      setDownGlobalXlsx(true);
      const blob = await downloadUsoGlobalXlsx({ from, to });
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
      const blob = await downloadUsoGlobalPdf({ from, to });
      const url = window.URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch (err) {
      console.error(err);
    } finally {
      setDownGlobalPdf(false);
    }
  };

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

          {mode === "resumen" && (
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
          )}

          {mode === "global" && (
            <>
              <Button onClick={handleFetchGlobal} isProcessing={loadingGlobal}>
                Actualizar
              </Button>
              <Button
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
            </>
          )}

          {mode === "inventario" && (
            <Button
              onClick={handleDownloadInventarioXlsx}
              isProcessing={downInventarioXlsx}
            >
              Descargar XLSX
            </Button>
          )}
        </div>
      </Card>

      {/* RESUMEN (tu bitácora personal, sigue como stub) */}
      {mode === "resumen" && (
        <Card>
          <p className="text-sm text-gray-500 mb-2">
            Aquí irá la bitácora personal (GET <code>/history/my-usage</code>)
            filtrada por fecha/tipo.
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
            <Table.Body className="divide-y">{/* TODO */}</Table.Body>
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
                <Table.Row
                  key={`${r.lab_id}-${r.recurso_id}`}
                >
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
