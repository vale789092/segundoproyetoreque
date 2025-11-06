import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { Card, Tabs } from "flowbite-react";
import { getLab } from "@/services/labs";

export default function LabDetail() {
  const { id = "" } = useParams();
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState<string|null>(null);

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
          <pre className="text-xs">{JSON.stringify(data.policies, null, 2)}</pre>
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
