import { useEffect, useState } from "react";
import { Card, Button, Label, Select, Table, Badge } from "flowbite-react";
import { listLabs, type LabRow } from "@/services/labs";
import { getLabHistory, downloadLabHistoryPdf, type BitacoraRow } from "@/services/bitacora";

export default function Bitacora() {
  const [labs, setLabs] = useState<LabRow[]>([]);
  const [labId, setLabId] = useState<string>("");
  const [rows, setRows] = useState<BitacoraRow[]>([]);
  const [loading, setLoading] = useState(false);

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

  async function handleBuscar() {
    if (!labId) return;
    setLoading(true);
    try {
      const data = await getLabHistory(labId);
      setRows(data);
    } catch (e: any) {
      alert(e?.message ?? "No se pudo cargar la bitácora");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  async function handlePdf() {
    if (!labId) return alert("Selecciona un laboratorio.");
    try {
      await downloadLabHistoryPdf(labId);
    } catch (e: any) {
      alert(e?.message ?? "No se pudo exportar el PDF");
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Bitácora</h2>

      <Card>
        <div className="grid grid-cols-12 gap-4 items-end">
          <div className="col-span-12 md:col-span-8">
            <Label value="Laboratorio" />
            <Select value={labId} onChange={(e) => setLabId(e.target.value)}>
              {labs.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nombre} — {l.ubicacion}
                </option>
              ))}
            </Select>
          </div>

          <div className="col-span-6 md:col-span-2">
            <Button color="light" onClick={handleBuscar} isProcessing={loading} disabled={!labId}>
              Buscar
            </Button>
          </div>
          <div className="col-span-6 md:col-span-2">
            <Button onClick={handlePdf} disabled={!labId}>
              Exportar PDF
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <Table className="min-w-[1000px]">
            <Table.Head>
              <Table.HeadCell>Fecha/Hora</Table.HeadCell>
              <Table.HeadCell>Laboratorio</Table.HeadCell>
              <Table.HeadCell>Acción</Table.HeadCell>
              <Table.HeadCell>Detalle</Table.HeadCell>
              <Table.HeadCell>Usuario</Table.HeadCell>
            </Table.Head>
            <Table.Body className="divide-y">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-4 text-slate-500">
                    Sin resultados.
                  </td>
                </tr>
              ) : (
                rows.map((r, i) => (
                  <Table.Row key={i}>
                    <Table.Cell>{new Date(r.ts).toLocaleString()}</Table.Cell>
                    <Table.Cell>{r.lab_nombre}</Table.Cell>
                    <Table.Cell>
                      <Badge color="info">{r.accion}</Badge>
                    </Table.Cell>
                    <Table.Cell className="max-w-[520px]">
                      <code className="text-xs break-words">
                        {r.detalle ? JSON.stringify(r.detalle) : ""}
                      </code>
                    </Table.Cell>
                    <Table.Cell>{r.user_nombre || ""}</Table.Cell>
                  </Table.Row>
                ))
              )}
            </Table.Body>
          </Table>
        </div>
      </Card>
    </div>
  );
}
