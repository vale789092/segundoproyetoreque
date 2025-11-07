// src/views/labs/LabDetail.tsx
import React, { useEffect, useState, useMemo } from "react";
import { useParams } from "react-router";
import { Card, Tabs, Badge } from "flowbite-react";
import { getLab, listLabPolicies, listLabTechnicians } from "@/services/labs";
import TechniciansTable from "@/views/labs/TechniciansTable";
import PoliciesTab from "@/views/labs/PoliciesTab";

type RouteParams = { id?: string; labId?: string };

type LabRowLike = {
  id?: string;
  nombre?: string;
  ubicacion?: string;
  codigo_interno?: string;
  descripcion?: string | null;
};

type PolicyLike = {
  id: string;
  nombre?: string;
  descripcion?: string | null;
  tipo?: "seguridad" | "academico" | "otro" | string;
  obligatorio?: boolean;
  vigente_desde?: string | null;
  vigente_hasta?: string | null;
};

export default function LabDetail() {
  // Soporta /app/labs/:id y /app/labs/:labId
  const { id: idA, labId: idB } = useParams<RouteParams>();
  const labId = (idA ?? idB ?? "").trim();

  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  const [pols, setPols] = useState<PolicyLike[]>([]);
  const [loadingPols, setLoadingPols] = useState(false);

  // Carga políticas
  useEffect(() => {
    if (!labId) return;
    let alive = true;
    (async () => {
      setLoadingPols(true);
      try {
        const rows = await listLabPolicies(labId);
        if (!alive) return;
        setPols(Array.isArray(rows) ? rows : []);
      } finally {
        if (alive) setLoadingPols(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [labId]);

  // Carga detalle de lab
  useEffect(() => {
    if (!labId) return;
    let alive = true;
    (async () => {
      try {
        setErr(null);
        const d = await getLab(labId);
        if (!alive) return;
        setData(d ?? null);
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message ?? "Error cargando");
        setData(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, [labId]);

  // Normalización robusta: soporta { lab, technicians, policies } o un objeto lab plano
  const lab: LabRowLike | null = useMemo(() => {
    if (!data) return null;
    // Si viene con { lab, technicians, policies }
    if (typeof data === "object" && data !== null && "lab" in data) {
      return (data as any).lab ?? null;
    }
    // Si viene plano (sólo el lab)
    return data as LabRowLike;
  }, [data]);

  if (err) return <Card><p className="text-red-600">{err}</p></Card>;
  if (!labId) return <Card><p>Laboratorio no encontrado.</p></Card>;
  if (!data || !lab) return <Card><p>Cargando…</p></Card>;

  return (
    <div className="space-y-4">
      <Card>
        <h3 className="text-lg font-semibold">{lab?.nombre ?? "Laboratorio"}</h3>
        <p className="text-sm text-slate-600">{lab?.ubicacion ?? "—"}</p>
        <p className="text-xs text-slate-400">{lab?.codigo_interno ?? "—"}</p>
        {lab?.descripcion && <p className="text-sm mt-2">{lab.descripcion}</p>}
      </Card>

      <Tabs>
        <Tabs.Item title="Técnicos">
          {/* CRUD de tecnicos_labs */}
          <div id="lab-technicians" />
          <TechniciansTable labId={labId} />
        </Tabs.Item>

        <Tabs.Item title="Políticas">
          <PoliciesTab labId={labId} />
        </Tabs.Item>

        <Tabs.Item title="Equipos">
          <p>Pendiente de implementar.</p>
        </Tabs.Item>

        <Tabs.Item title="Historial">
          <p>Pendiente de implementar (GET /labs/:id/history).</p>
        </Tabs.Item>
      </Tabs>
    </div>
  );
}
