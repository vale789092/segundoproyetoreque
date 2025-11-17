// src/views/operacion/MisSolicitudes.tsx
import { useEffect, useState } from "react";
import { Badge, Button, Card, Table } from "flowbite-react";
import { Icon } from "@iconify/react";
import {
  listMisSolicitudes,
  cancelSolicitud,
  type SolicitudRow,
  type SolicitudEstado,
} from "@/services/solicitudes";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import { getUser } from "@/services/storage";
import { registrarDevolucion } from "@/services/prestamos";

function EstadoBadge({ estado }: { estado: SolicitudEstado }) {
  const color =
    estado === "pendiente"
      ? "warning"
      : estado === "en_revision"
      ? "purple"
      : estado === "aprobada"
      ? "success"
      : estado === "rechazada"
      ? "failure"
      : "gray";
  return <Badge color={color}>{estado}</Badge>;
}

export default function MisSolicitudes() {
  const me = getUser() as
    | { rol?: "estudiante" | "profesor" | "tecnico" | "admin" }
    | null;

  // cancelar solo si está pendiente (el backend también valida)
  const canCancel = (s: SolicitudRow) => s.estado === "pendiente";

  // se puede devolver si está aprobada y aún no tiene fecha_devolucion
  const canDevolver = (s: SolicitudRow) =>
    s.estado === "aprobada" && !s.fecha_devolucion;

  const [rows, setRows] = useState<SolicitudRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [openCancel, setOpenCancel] = useState<{ open: boolean; id?: string }>({
    open: false,
  });
  const [doing, setDoing] = useState(false); // se usa tanto para cancelar como para devolver

  async function refresh() {
    setLoading(true);
    setErr(null);
    try {
      const data = await listMisSolicitudes();
      setRows(data);
    } catch (e: any) {
      setErr(e?.message ?? "Error cargando solicitudes");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const cancel = async () => {
    if (!openCancel.id) return;
    setDoing(true);
    try {
      await cancelSolicitud(openCancel.id);
      setOpenCancel({ open: false });
      await refresh();
    } catch (e: any) {
      alert(
        e?.response?.data?.error?.message ??
          e?.message ??
          "No se pudo cancelar"
      );
    } finally {
      setDoing(false);
    }
  };

  const handleDevolver = async (id: string) => {
    const confirm = window.confirm("¿Devolver el equipo de esta solicitud?");
    if (!confirm) return;
    try {
      setDoing(true);
      await registrarDevolucion(id);
      await refresh();
    } catch (e: any) {
      alert(e?.message ?? "No se pudo registrar la devolución.");
    } finally {
      setDoing(false);
    }
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleString("es-CR", {
      dateStyle: "short",
      timeStyle: "short",
    });

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
                {rows.map((r) => (
                  <Table.Row key={r.id}>
                    <Table.Cell>{r.lab_nombre}</Table.Cell>
                    <Table.Cell>{r.recurso_nombre}</Table.Cell>
                    <Table.Cell>{formatDate(r.fecha_uso_inicio)}</Table.Cell>
                    <Table.Cell>{formatDate(r.fecha_uso_fin)}</Table.Cell>
                    <Table.Cell>
                      <EstadoBadge estado={r.estado} />
                    </Table.Cell>
                    <Table.Cell className="text-right space-x-2">
                      {(me?.rol === "estudiante" ||
                        me?.rol === "profesor") && (
                        <>
                          {/* Cancelar */}
                          <Button
                            size="xs"
                            color="light"
                            disabled={!canCancel(r) || doing}
                            onClick={() =>
                              setOpenCancel({ open: true, id: r.id })
                            }
                          >
                            <Icon
                              icon="solar:trash-bin-minimalistic-linear"
                              className="me-1"
                            />
                            Cancelar
                          </Button>

                          {/* Devolver */}
                          {canDevolver(r) && (
                            <Button
                              size="xs"
                              color="success"
                              disabled={doing}
                              onClick={() => handleDevolver(r.id)}
                            >
                              <Icon
                                icon="solar:box-minimalistic-linear"
                                className="me-1"
                              />
                              Devolver equipo
                            </Button>
                          )}
                        </>
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
        onClose={() => setOpenCancel({ open: false })}
        onConfirm={cancel}
        confirming={doing}
        title="Cancelar solicitud"
        message="¿Deseas cancelar esta solicitud? Solo se puede cancelar si está pendiente y con fecha futura."
      />
    </div>
  );
}
