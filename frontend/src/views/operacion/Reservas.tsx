// src/views/operacion/Reservas.tsx
import { useEffect, useState } from "react";
import { Button, Card, Label, Select } from "flowbite-react";
import { Icon } from "@iconify/react";
import { listLabs, LabRow } from "@/services/labs";
import SolicitudForm from "@/components/solicitudes/SolicitudForm";
import { createSolicitud } from "@/services/solicitudes";
import { getUser } from "@/services/storage";

export default function Reservas() {
  const me = getUser() as { rol?: "estudiante"|"profesor"|"tecnico"|"admin" } | null;

  const [labs, setLabs] = useState<LabRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string|null>(null);

  const [labId, setLabId] = useState<string>("");
  const [openForm, setOpenForm] = useState(false);
  const [, setSending] = useState(false);

  useEffect(()=>{ (async()=>{
    setLoading(true);
    try { setLabs(await listLabs()); }
    catch(e:any){ setErr(e?.message ?? "Error cargando laboratorios"); }
    finally{ setLoading(false); }
  })(); }, []);

  const submitSolicitud = async (v: any) => {
    setSending(true);
    try {
      await createSolicitud(v);
      setOpenForm(false);
      alert("Solicitud enviada.");
    } catch (e:any) {
      alert(e?.response?.data?.error?.message ?? e?.message ?? "No se pudo enviar la solicitud");
    } finally { setSending(false); }
  };

  const canCreate = me?.rol === "estudiante" || me?.rol === "profesor";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Reservas — Nueva solicitud</h3>
        <Button className="bg-primary text-white" onClick={()=> setOpenForm(true)} disabled={!labId || loading || !canCreate}>
          <Icon icon="solar:calendar-add-linear" className="me-2" /> Nueva solicitud
        </Button>
      </div>

      <Card>
        {loading ? (
          <p>Cargando…</p>
        ) : err ? (
          <p className="text-red-600">{err}</p>
        ) : (
          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-12 md:col-span-6">
              <Label value="Laboratorio" />
              <Select value={labId} onChange={(e)=>setLabId(e.target.value)}>
                <option value="">Selecciona un laboratorio…</option>
                {labs.map(l => (
                  <option key={l.id} value={l.id}>{l.nombre} — {l.ubicacion}</option>
                ))}
              </Select>
              <p className="text-xs text-slate-500 mt-2">
                Selecciona lab para ver recursos en el formulario.
              </p>
            </div>
          </div>
        )}
      </Card>

      <SolicitudForm
        open={openForm}
        onClose={()=> setOpenForm(false)}
        onSubmit={submitSolicitud}
        labId={labId}
      />
    </div>
  );
}
