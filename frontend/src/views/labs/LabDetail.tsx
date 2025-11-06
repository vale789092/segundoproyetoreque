import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { Card, Tabs, Badge } from "flowbite-react";
import { getLab } from "@/services/labs";
import { listPolicies } from "@/services/labs";

export default function LabDetail() {
  type RouteParams = { id: string };
  const { id = "" } = useParams();
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState<string|null>(null);
  const [pols, setPols] = useState<any[]>([]);
  const [loadingPols, setLoadingPols] = useState(false);
  const { id: labId } = useParams<RouteParams>();

  useEffect(() => {
    if (!labId) return;
    (async () => {
      setLoadingPols(true);
      try {
        const rows = await listPolicies(labId);
        setPols(rows);
      } finally { setLoadingPols(false); }
    })();
  }, [labId]);

  useEffect(() => {
    (async () => {
      try {
        setErr(null);
        const d = await getLab(id);
        setData(d);
      } catch (e:any) { setErr(e?.message ?? "Error cargando"); }
    })();
  }, [id]);

  if (err) return <Card><p className="text-red-600">{err}</p></Card>;
  if (!data) return <Card><p>Cargando…</p></Card>;

  const { lab } = data;
  return (
    <div className="space-y-4">
      <Card>
        <h3 className="text-lg font-semibold">{lab.nombre}</h3>
        <p className="text-sm text-slate-600">{lab.ubicacion}</p>
        <p className="text-xs text-slate-400">{lab.codigo_interno}</p>
        {lab.descripcion && <p className="text-sm mt-2">{lab.descripcion}</p>}
      </Card>

      <Tabs>
        <Tabs.Item title="Técnicos">
          {/* aquí montarás CRUD de tecnicos_labs */}
          <pre className="text-xs">{JSON.stringify(data.technicians, null, 2)}</pre>
        </Tabs.Item>
        <Tabs.Item title="Políticas">
          {/* CRUD de requisitos */}
          <div className="space-y-3">
    {loadingPols ? <p>Cargando políticas…</p> :
      pols.length === 0 ? <p className="text-sm text-slate-500">Este laboratorio no tiene políticas publicadas.</p> :
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {pols.map(p => (
          <Card key={p.id} className="rounded-2xl">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">{p.nombre}</h4>
              <Badge color={p.tipo === "seguridad" ? "red" : p.tipo === "academico" ? "indigo" : "gray"}>
                {p.tipo}
              </Badge>
            </div>
            {p.descripcion && <p className="text-sm text-slate-600">{p.descripcion}</p>}
            <div className="text-xs text-slate-500 space-x-2">
              <Badge color={p.obligatorio ? "blue" : "gray"}>{p.obligatorio ? "Obligatorio" : "Opcional"}</Badge>
              {p.vigente_desde && <span>Desde: {new Date(p.vigente_desde).toLocaleDateString()}</span>}
              {p.vigente_hasta && <span>Hasta: {new Date(p.vigente_hasta).toLocaleDateString()}</span>}
            </div>
          </Card>
        ))}
      </div>
    }
  </div>
        </Tabs.Item>
        <Tabs.Item title="Equipos">
          {/* Lista de /labs/:id/equipos */}
          <p>Pendiente de implementar.</p>
        </Tabs.Item>
        <Tabs.Item title="Historial">
          <p>Pendiente de implementar (GET /labs/:id/history).</p>
        </Tabs.Item>
      </Tabs>
    </div>
  );
}
