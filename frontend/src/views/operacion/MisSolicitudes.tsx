// src/views/operacion/MisSolicitudes.tsx
import { useEffect, useState } from "react";
import { Badge, Button, Card, Table } from "flowbite-react";
import { Icon } from "@iconify/react";
import { listMisSolicitudes, cancelSolicitud, type SolicitudRow, type SolicitudEstado } from "@/services/solicitudes";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import { getUser } from "@/services/storage";

function EstadoBadge({ estado }: { estado: SolicitudEstado }) {
  const color =
    estado === "pendiente" ? "warning" :
    estado === "en_revision" ? "purple" :
    estado === "aprobada" ? "success" :
    estado === "rechazada" ? "failure" : "gray";
  return <Badge color={color}>{estado}</Badge>;
}

export default function MisSolicitudes() {
  const me = getUser() as { rol?: "estudiante"|"profesor"|"tecnico"|"admin" } | null;
  const canCancel = (s: SolicitudRow) => s.estado === "pendiente"; // el backend ya valida futura

  const [rows, setRows] = useState<SolicitudRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string|null>(null);
  const [openCancel, setOpenCancel] = useState<{open:boolean; id?:string}>({open:false});
  const [doing, setDoing] = useState(false);

  async function refresh() {
    setLoading(true);
    setErr(null);
    try { setRows(await listMisSolicitudes()); }
    catch (e:any) { setErr(e?.message ?? "Error cargando solicitudes"); }
    finally { setLoading(false); }
  }
  useEffect(()=>{ refresh(); }, []);

  const cancel = async () => {
    if (!openCancel.id) return;
    setDoing(true);
    try {
      await cancelSolicitud(openCancel.id);
      setOpenCancel({open:false});
      await refresh();
    } catch (e:any) {
      alert(e?.response?.data?.error?.message ?? e?.message ?? "No se pudo cancelar");
    } finally { setDoing(false); }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Mis solicitudes</h3>
      <Card>
        {loading ? (
          <p>Cargando…</p>
        ) : err ? (
          <p className="text-red-600">{err}</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-slate-500">Aún no tienes solicitudes.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <Table.Head>
                <Table.HeadCell>Laboratorio</Table.HeadCell>
                <Table.HeadCell>Recurso</Table.HeadCell>
                <Table.HeadCell>Inicio</Table.HeadCell>
                <Table.HeadCell>Fin</Table.HeadCell>
                <Table.HeadCell>Estado</Table.HeadCell>
                <Table.HeadCell></Table.HeadCell>
              </Table.Head>
              <Table.Body className="divide-y">
                {rows.map(r => (
                  <Table.Row key={r.id}>
                    <Table.Cell>{r.lab_nombre}</Table.Cell>
                    <Table.Cell>{r.recurso_nombre}</Table.Cell>
                    <Table.Cell>{new Date(r.fecha_uso_inicio).toLocaleString()}</Table.Cell>
                    <Table.Cell>{new Date(r.fecha_uso_fin).toLocaleString()}</Table.Cell>
                    <Table.Cell><EstadoBadge estado={r.estado} /></Table.Cell>
                    <Table.Cell className="text-right">
                      {(me?.rol === "estudiante" || me?.rol === "profesor") && (
                        <Button
                          size="xs"
                          color="light"
                          disabled={!canCancel(r)}
                          onClick={() => setOpenCancel({open:true, id:r.id})}
                        >
                          <Icon icon="solar:trash-bin-minimalistic-linear" className="me-1" />
                          Cancelar
                        </Button>
                      )}
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={openCancel.open}
        onClose={()=> setOpenCancel({open:false})}
        onConfirm={cancel}
        confirming={doing}
        title="Cancelar solicitud"
        message="¿Deseas cancelar esta solicitud? Solo se puede cancelar si está pendiente y con fecha futura."
      />
    </div>
  );
}
