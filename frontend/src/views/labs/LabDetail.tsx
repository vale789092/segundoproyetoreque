// src/views/labs/LabDetail.tsx
import { useEffect, useState, useMemo } from "react";
import { useParams } from "react-router";
import { Card, Tabs } from "flowbite-react";
import { getLab } from "@/services/labs"; 
import TechniciansTable from "@/views/labs/TechniciansTable";
import PoliciesTab from "@/views/labs/PoliciesTab";
import HistoryTab from "@/views/labs/HistoryTab";
import CalendarTab from "@/views/labs/CalendarTab";
import EquiposTab from "@/views/labs/EquiposTab";
import { getUser } from "@/services/storage";

type RouteParams = { id?: string; labId?: string };

type LabRowLike = {
  id?: string;
  nombre?: string;
  ubicacion?: string;
  codigo_interno?: string;
  descripcion?: string | null;
};

export default function LabDetail() {
  // Soporta /app/labs/:id y /app/labs/:labId
  const { id: idA, labId: idB } = useParams<RouteParams>();
  const labId = (idA ?? idB ?? "").trim();

  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  const me = (getUser() ?? {}) as {
    rol?: "estudiante" | "profesor" | "tecnico" | "admin";
  };
  const canSeeHistory = me.rol === "admin" || me.rol === "tecnico";

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

  if (err) {
    return (
      <Card>
        <p className="text-red-600">{err}</p>
      </Card>
    );
  }
  if (!labId) {
    return (
      <Card>
        <p>Laboratorio no encontrado.</p>
      </Card>
    );
  }
  if (!data || !lab) {
    return (
      <Card>
        <p>Cargando…</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <h3 className="text-lg font-semibold">
          {lab?.nombre ?? "Laboratorio"}
        </h3>
        <p className="text-sm text-slate-600">
          {lab?.ubicacion ?? "—"}
        </p>
        <p className="text-xs text-slate-400">
          {lab?.codigo_interno ?? "—"}
        </p>
        {lab?.descripcion && (
          <p className="text-sm mt-2">{lab.descripcion}</p>
        )}
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
          <EquiposTab labId={labId} />
        </Tabs.Item>

        {canSeeHistory && (
        <Tabs.Item title="Calendario">
          <CalendarTab labId={labId} />
        </Tabs.Item>
        )}

        {canSeeHistory && (
          <Tabs.Item title="Historial">
            <HistoryTab labId={labId} />
          </Tabs.Item>
        )}

        

      </Tabs>
    </div>
  );
}
