// src/components/solicitudes/SolicitudForm.tsx
import { useEffect, useMemo, useState } from "react";
import { Button, Label, Modal, Select, TextInput, Textarea } from "flowbite-react";
import { listEquiposByCriteria, type EquipoRow, listLabHorarios } from "@/services/labs";

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (v: {
    laboratorio_id: string;
    recurso_id: string;
    fecha_uso_inicio: string; // ISO
    fecha_uso_fin: string;    // ISO
    motivo?: string;
  }) => Promise<void> | void;
  labId?: string;
  initial?: Partial<{ fecha: string; hora_desde: string; hora_hasta: string; recurso_id: string; motivo: string }>;
};

function localDateTimeToISO(fecha: string, hhmm: string) {
  // Construye en local y lo serializa a ISO (incluye offset)
  const iso = new Date(`${fecha}T${hhmm}:00`).toISOString();
  return iso;
}

export default function SolicitudForm({ open, onClose, onSubmit, labId = "", initial }: Props) {
  const [fecha, setFecha]     = useState(initial?.fecha ?? new Date().toISOString().slice(0,10));
  const [desde, setDesde]     = useState(initial?.hora_desde ?? "08:00");
  const [hasta, setHasta]     = useState(initial?.hora_hasta ?? "10:00");
  const [recursoId, setRecursoId] = useState(initial?.recurso_id ?? "");
  const [motivo, setMotivo]   = useState(initial?.motivo ?? "");

  const [equipos, setEquipos] = useState<EquipoRow[]>([]);
  const [cargandoEq, setCargandoEq] = useState(false);
  const [slots, setSlots] = useState<Array<{desde:string; hasta:string; bloqueado?:boolean; motivo?:string|null}>>([]);
  const [cargandoSlots, setCargandoSlots] = useState(false);

  useEffect(() => {
    if (!open || !labId) return;
    let alive = true;
    (async () => {
      setCargandoEq(true);
      try {
        const rows = await listEquiposByCriteria({ labId, soloDisponibles: false });
        if (alive) setEquipos(rows.filter(r => r.reservable));
      } finally { setCargandoEq(false); }
    })();
    return () => { alive = false; };
  }, [open, labId]);

  useEffect(() => {
    if (!open || !labId || !fecha) return;
    let alive = true;
    (async () => {
      setCargandoSlots(true);
      try {
        const s = await listLabHorarios(labId, fecha);
        if (alive) setSlots(s);
      } finally { setCargandoSlots(false); }
    })();
    return () => { alive = false; };
  }, [open, labId, fecha]);

  const errMsg = useMemo(() => {
    const toMin = (hhmm: string) => { const [h,m] = hhmm.split(":").map(Number); return h*60+(m||0); };
    if (toMin(hasta) <= toMin(desde)) return "El rango horario es inválido.";
    const overlap = slots.some(s => s.bloqueado && Math.max(toMin(s.desde), toMin(desde)) < Math.min(toMin(s.hasta), toMin(hasta)));
    if (overlap) return "Se superpone con un bloqueo del laboratorio.";
    const eq = equipos.find(e => e.id === recursoId);
    if (!eq) return "Debes seleccionar un recurso.";
    if (!eq.reservable || eq.estado_disp !== "disponible" || eq.cantidad_disponible <= 0) return "El recurso no está disponible.";
    return null;
  }, [desde, hasta, slots, equipos, recursoId]);

  const submit = async () => {
    if (errMsg || !labId) return;
    await onSubmit({
      laboratorio_id: labId,
      recurso_id: recursoId,
      fecha_uso_inicio: localDateTimeToISO(fecha, desde),
      fecha_uso_fin:    localDateTimeToISO(fecha, hasta),
      motivo: motivo?.trim() || undefined,
    });
  };

  return (
    <Modal show={open} onClose={onClose}>
      <Modal.Header>Nueva solicitud</Modal.Header>
      <Modal.Body>
        {!labId ? (
          <p className="text-sm text-red-600">Selecciona un laboratorio antes de solicitar.</p>
        ) : (
          <div className="space-y-3">
            <div>
              <Label value="Recurso" />
              <Select value={recursoId} onChange={(e)=>setRecursoId(e.target.value)} disabled={cargandoEq || !equipos.length}>
                <option value="" disabled>{cargandoEq ? "Cargando..." : "Selecciona un recurso"}</option>
                {equipos.map(eq => (
                  <option key={eq.id} value={eq.id}>
                    {eq.nombre} — {eq.estado_disp} ({eq.cantidad_disponible}/{eq.cantidad_total})
                  </option>
                ))}
              </Select>
            </div>

            <div className="grid grid-cols-12 gap-3">
              <div className="col-span-6">
                <Label value="Fecha" />
                <TextInput type="date" value={fecha} onChange={(e)=>setFecha(e.target.value)} />
              </div>
              <div className="col-span-3">
                <Label value="Desde" />
                <TextInput type="time" value={desde} onChange={(e)=>setDesde(e.target.value)} />
              </div>
              <div className="col-span-3">
                <Label value="Hasta" />
                <TextInput type="time" value={hasta} onChange={(e)=>setHasta(e.target.value)} />
              </div>
            </div>

            <div>
              <Label value="Motivo (opcional)" />
              <Textarea rows={3} value={motivo} onChange={(e)=>setMotivo(e.target.value)} />
            </div>

            <div>
              <Label value="Disponibilidad del día" />
              <div className="mt-2 flex gap-2 flex-wrap">
                {cargandoSlots ? (
                  <span className="text-sm text-slate-500">Cargando…</span>
                ) : slots.length === 0 ? (
                  <span className="text-sm text-slate-500">Sin información.</span>
                ) : slots.map((s, i)=>(
                  <span key={i} className={`px-3 py-0.5 rounded-full text-xs ${s.bloqueado ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}>
                    {s.desde}–{s.hasta}{s.bloqueado ? " • Bloqueado" : ""}
                  </span>
                ))}
              </div>
            </div>

            {errMsg && <p className="text-sm text-red-600">{errMsg}</p>}
          </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button className="bg-primary text-white" onClick={submit} disabled={!labId || !!errMsg}>
          Enviar solicitud
        </Button>
        <Button color="light" onClick={onClose}>Cancelar</Button>
      </Modal.Footer>
    </Modal>
  );
}
