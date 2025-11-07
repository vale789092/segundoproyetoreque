import { useEffect, useState } from "react";
import { Badge, Button, Card, Label, Select, Table, TextInput } from "flowbite-react";
import { Icon } from "@iconify/react";
import { listLabs, type LabRow } from "@/services/labs";
import { listSolicitudesAdmin, setSolicitudStatus, type SolicitudAdminRow, type SolicitudEstado } from "@/services/solicitudes";
import { getUser } from "@/services/storage";
import { useNavigate } from "react-router";
import { Tooltip } from "flowbite-react";

const EstadoPill = ({ v }: { v: SolicitudEstado }) => (
  <Badge color={v==="pendiente"?"warning":v==="en_revision"?"purple":v==="aprobada"?"success":"failure"}>{v}</Badge>
);

export default function SolicitudesAdmin() {
  const me = getUser() as { rol?: "estudiante"|"profesor"|"tecnico"|"admin" } | null;
  const nav = useNavigate();
  const [labs, setLabs] = useState<LabRow[]>([]);
  const [rows, setRows] = useState<SolicitudAdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string|null>(null);

  // filtros
  const [estado, setEstado] = useState<""|SolicitudEstado>("");
  const [labId, setLabId] = useState<string>("");
  const [q, setQ] = useState("");

  const canAct = me?.rol === "admin" || me?.rol === "tecnico";

  async function refresh() {
    setLoading(true); setErr(null);
    try {
      const data = await listSolicitudesAdmin({ estado: estado || undefined, lab_id: labId || undefined, q: q || undefined, limit: 100 });
      setRows(data);
    } catch (e:any) { setErr(e?.message ?? "Error cargando solicitudes"); }
    finally { setLoading(false); }
  }

  useEffect(() => { (async () => setLabs(await listLabs()))(); }, []);
  useEffect(() => { refresh(); }, [estado, labId]); // carga inicial y cuando cambian filtros clave

  const act = async (id: string, nuevo: "aprobada"|"rechazada"|"en_revision") => {
    try { await setSolicitudStatus(id, nuevo); await refresh(); }
    catch (e:any) { alert(e?.response?.data?.error?.message ?? e?.message ?? "No se pudo actualizar estado"); }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Aprobación de solicitudes</h3>

      <Card>
        <div className="grid md:grid-cols-6 gap-3">
          <div className="md:col-span-2">
            <Label value="Laboratorio" />
            <Select value={labId} onChange={(e)=>setLabId(e.target.value)}>
              <option value="">(Todos)</option>
              {labs.map(l => <option key={l.id} value={l.id}>{l.nombre} — {l.ubicacion}</option>)}
            </Select>
          </div>
          <div>
            <Label value="Estado" />
            <Select value={estado} onChange={(e)=>setEstado(e.target.value as any)}>
              <option value="">(Todos)</option>
              <option value="pendiente">pendiente</option>
              <option value="en_revision">en_revision</option>
              <option value="aprobada">aprobada</option>
              <option value="rechazada">rechazada</option>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label value="Buscar (lab / recurso / código)" />
            <TextInput value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Osciloscopio, EQ-OSC-001..." />
          </div>
          <div className="flex items-end">
            <Button className="bg-primary text-white" onClick={refresh}>
              <Icon icon="solar:magnifer-linear" className="me-2" /> Buscar
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        {loading ? (
          <p>Cargando…</p>
        ) : err ? (
          <p className="text-red-600">{err}</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-slate-500">No hay solicitudes con los filtros actuales.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <Table.Head>
                <Table.HeadCell>Creada</Table.HeadCell>
                <Table.HeadCell>Usuario</Table.HeadCell>
                <Table.HeadCell>Laboratorio</Table.HeadCell>
                <Table.HeadCell>Recurso</Table.HeadCell>
                <Table.HeadCell>Uso (inicio → fin)</Table.HeadCell>
                <Table.HeadCell>Estado</Table.HeadCell>
                <Table.HeadCell className="text-right">Acciones</Table.HeadCell>
              </Table.Head>
              <Table.Body className="divide-y">
                {rows.map(r => (
                  <Table.Row key={r.id}>
                    <Table.Cell>{new Date(r.creada_en).toLocaleString()}</Table.Cell>
                    <Table.Cell>
                      <div className="text-sm">{r.usuario_nombre || r.usuario_id}</div>
                      <div className="text-xs text-slate-500">{r.usuario_correo}</div>
                    </Table.Cell>
                    <Table.Cell>{r.lab_nombre}</Table.Cell>
                    <Table.Cell>
                      <div className="text-sm">{r.recurso_nombre}</div>
                      <div className="text-xs text-slate-500">{r.codigo_inventario}</div>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="text-sm">{new Date(r.fecha_uso_inicio).toLocaleString()}</div>
                      <div className="text-xs text-slate-500">→ {new Date(r.fecha_uso_fin).toLocaleString()}</div>
                    </Table.Cell>
                    <Table.Cell><EstadoPill v={r.estado} /></Table.Cell>
                    <Table.Cell className="text-right">
  <div className="flex flex-wrap justify-end gap-2">
    <Tooltip content="Ver recurso">
      <Button
  size="xs"
  color="light"
  className="!h-8 !min-h-[32px] !py-0 !px-3 !text-xs !leading-none flex items-center gap-1"
  onClick={()=>nav(`/app/labs/${r.lab_id}?equipo=${r.recurso_id}`)}
>
  <Icon icon="solar:box-linear" className="h-4 w-4" /> Ver
</Button>
    </Tooltip>

    {canAct && (
      <div className="inline-flex items-center gap-2">
        <Tooltip content="Aprobar">
          <Button
  size="xs"
  color="success"
  className="!h-8 !min-h-[32px] !py-0 !px-3 !text-xs !leading-none flex items-center gap-1"
  onClick={()=>act(r.id,"aprobada")}
>
  <Icon icon="solar:check-circle-linear" className="h-4 w-4" /> Aprobar
</Button>
        </Tooltip>

        <Tooltip content="Marcar en revisión">
          <Button
  size="xs"
  color="warning"
  className="!h-8 !min-h-[32px] !py-0 !px-3 !text-xs !leading-none flex items-center gap-1"
  onClick={()=>act(r.id,"en_revision")}
>
  <Icon icon="solar:clock-circle-linear" className="h-4 w-4" /> En revisión
</Button>
        </Tooltip>

        <Tooltip content="Rechazar">
          <Button
  size="xs"
  color="failure"
  className="!h-8 !min-h-[32px] !py-0 !px-3 !text-xs !leading-none flex items-center gap-1"
  onClick={()=>act(r.id,"rechazada")}
>
  <Icon icon="solar:close-circle-linear" className="h-4 w-4" /> Rechazar
</Button>
        </Tooltip>
      </div>
    )}
  </div>
</Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}
