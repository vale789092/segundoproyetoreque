// src/views/dashboards/Dashboard.tsx
import { useEffect, useMemo, useState } from "react";
import { Button, Card, Tooltip, Label, Select, TextInput, ToggleSwitch } from "flowbite-react";
import { Icon } from "@iconify/react";
import { useNavigate } from "react-router";
import { listLabs, createLab, updateLab, deleteLab, LabRow } from "@/services/labs";
import { listEquiposByCriteria, listLabHorariosMock, EquipoRow } from "@/services/labs";
import { getUser } from "@/services/storage";
import LabForm from "@/views/labs/LabForm";
import ConfirmDialog from "@/components/shared/ConfirmDialog";

type Rol = "estudiante" | "profesor" | "tecnico" | "admin";

export default function Dashboard() {
  const nav = useNavigate();
  const me = (getUser() ?? {}) as { rol?: Rol };

  // -------- Laboratorios (CRUD) --------
  const [labs, setLabs] = useState<LabRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [openCreate, setOpenCreate] = useState(false);
  const [openEdit, setOpenEdit] = useState<{open:boolean; lab?: LabRow}>({open:false});
  const [openDelete, setOpenDelete] = useState<{open:boolean; lab?: LabRow}>({open:false});
  const [submitting, setSubmitting] = useState(false);

  async function refresh() {
    setLoading(true);
    setErr(null);
    try {
      const data = await listLabs();
      setLabs(data);
    } catch (e:any) {
      setErr(e?.message ?? "Error cargando laboratorios");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { refresh(); }, []);

  const canManageLabs = me.rol === "admin" || me.rol === "tecnico"; // permisos CRUD
  const canSearch = ["estudiante","profesor","tecnico","admin"].includes(me.rol ?? "estudiante");

  // -------- Búsqueda por criterios (3.2.1) --------
  const [selLabId, setSelLabId] = useState<string>("");
  const [tipo, setTipo] = useState<"" | "equipo" | "material" | "software">("");
  const [soloDisp, setSoloDisp] = useState(true);
  const [fecha, setFecha] = useState<string>(() => new Date().toISOString().slice(0,10)); // YYYY-MM-DD
  const [horaDesde, setHoraDesde] = useState("08:00");
  const [horaHasta, setHoraHasta] = useState("10:00");

  const [resultEquipos, setResultEquipos] = useState<EquipoRow[]>([]);
  const [resultHorarios, setResultHorarios] = useState<{ slots: Awaited<ReturnType<typeof listLabHorariosMock>>; cargando:boolean; }>(
    { slots: [], cargando: false }
  );
  const [buscando, setBuscando] = useState(false);

  // cargar horarios cuando cambian lab/fecha
  useEffect(() => {
    let alive = true;
    if (!selLabId || !fecha) { setResultHorarios({slots:[], cargando:false}); return; }
    setResultHorarios(s => ({...s, cargando:true}));
    (async () => {
      const slots = await listLabHorariosMock(selLabId, fecha);
      if (alive) setResultHorarios({ slots, cargando:false });
    })();
    return () => { alive = false; }
  }, [selLabId, fecha]);

  const hayChoqueHorario = useMemo(() => {
    const toMin = (hhmm: string) => {
      const [h,m] = hhmm.split(":").map(Number);
      return (h*60)+(m||0);
    };
    const selA = toMin(horaDesde);
    const selB = toMin(horaHasta);
    return resultHorarios.slots.some(s => {
      if (!s.bloqueado) return false;
      const a = toMin(s.desde);
      const b = toMin(s.hasta);
      return Math.max(a, selA) < Math.min(b, selB); // overlap
    });
  }, [resultHorarios.slots, horaDesde, horaHasta]);

  const doSearch = async () => {
    if (!selLabId) { alert("Selecciona un laboratorio"); return; }
    setBuscando(true);
    try {
      const rows = await listEquiposByCriteria({
        labId: selLabId,
        // @ts-expect-error: la firma original no recibe 'tipo' (si tu servicio lo soporta, añádelo)
        tipo: (tipo || undefined) as any,
        soloDisponibles: soloDisp
      });
      setResultEquipos(rows);
    } catch (e:any) {
      alert(e?.message ?? "Error buscando recursos");
      setResultEquipos([]);
    } finally {
      setBuscando(false);
    }
  };

  return (
    <div className="space-y-6">

      {/* === Sección de Búsqueda (Estudiantes/Profesores) === */}
      {canSearch && (
        <Card>
          <h3 className="text-lg font-semibold mb-2">Búsqueda y consulta de disponibilidad</h3>
          <p className="text-sm text-slate-500 mb-4">
            Elige laboratorio y criterios. Luego validamos disponibilidad por tipo y estado.
          </p>

          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-12 md:col-span-4">
              <Label htmlFor="labSel" value="Laboratorio" />
              <Select id="labSel" value={selLabId} onChange={(e)=>setSelLabId(e.target.value)}>
                <option value="">Selecciona un laboratorio…</option>
                {labs.map(l => (
                  <option key={l.id} value={l.id}>
                    {l.nombre} — {l.ubicacion}
                  </option>
                ))}
              </Select>
            </div>

            <div className="col-span-6 md:col-span-2">
              <Label htmlFor="tipoSel" value="Tipo de recurso" />
              <Select id="tipoSel" value={tipo} onChange={(e)=>setTipo(e.target.value as any)}>
                <option value="">(Todos)</option>
                <option value="equipo">Equipo</option>
                <option value="material">Material</option>
                <option value="software">Software</option>
              </Select>
            </div>

            <div className="col-span-6 md:col-span-3">
              <Label htmlFor="fechaSel" value="Fecha" />
              <TextInput id="fechaSel" type="date" value={fecha} onChange={(e)=>setFecha(e.target.value)} />
            </div>

            <div className="col-span-6 md:col-span-1">
              <Label htmlFor="hDesde" value="Desde" />
              <TextInput id="hDesde" type="time" value={horaDesde} onChange={(e)=>setHoraDesde(e.target.value)} />
            </div>

            <div className="col-span-6 md:col-span-1">
              <Label htmlFor="hHasta" value="Hasta" />
              <TextInput id="hHasta" type="time" value={horaHasta} onChange={(e)=>setHoraHasta(e.target.value)} />
            </div>

            <div className="col-span-12 md:col-span-1 flex items-end">
              <div className="flex items-center gap-2">
                <ToggleSwitch checked={soloDisp} label="Solo disp." onChange={setSoloDisp} />
              </div>
            </div>

            <div className="col-span-12 flex items-end justify-end">
              <Button className="bg-primary text-white" onClick={doSearch} isProcessing={buscando} disabled={buscando || !selLabId}>
                <Icon icon="solar:magnifer-linear" className="me-2" /> Buscar
              </Button>
            </div>
          </div>

          {/* Horarios (mock) */}
          <div className="mt-4">
            <Label value="Disponibilidad del día (vista rápida)" />
            <div className="mt-2 flex gap-2 flex-wrap">
              {resultHorarios.cargando ? (
                <span className="text-sm text-slate-500">Cargando horarios…</span>
              ) : resultHorarios.slots.length === 0 ? (
                <span className="text-sm text-slate-500">Sin información de horarios.</span>
              ) : (
                resultHorarios.slots.map((s, i) => (
                  <span
                    key={i}
                    className={`px-3 py-1 rounded-full text-sm ${
                      s.bloqueado ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"
                    }`}
                    title={s.bloqueado ? (s.motivo || "Bloqueado") : "Disponible"}
                  >
                    {s.desde}–{s.hasta} {s.bloqueado ? "• Bloqueado" : ""}
                  </span>
                ))
              )}
            </div>
            {hayChoqueHorario && (
              <p className="mt-2 text-sm text-amber-700">
                ⚠️ El rango seleccionado se superpone con un bloqueo del laboratorio.
              </p>
            )}
          </div>

          {/* Resultados */}
          <div className="mt-6">
            <Label value="Resultados" />
            <div className="mt-2 grid md:grid-cols-2 lg:grid-cols-3 gap-3">
              {resultEquipos.length === 0 ? (
                <Card><p className="text-sm text-slate-500">Sin resultados.</p></Card>
              ) : resultEquipos.map(eq => (
                <Card key={eq.id} className="hover:shadow-sm">
                  <div className="flex items-start justify-between">
                    <div className="font-medium">{eq.nombre}</div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      eq.estado_disp === "disponible" ? "bg-emerald-100 text-emerald-700" :
                      eq.estado_disp === "reservado" ? "bg-amber-100 text-amber-700" :
                      eq.estado_disp === "en_mantenimiento" ? "bg-sky-100 text-sky-700" :
                      "bg-slate-100 text-slate-700"
                    }`}>
                      {eq.estado_disp}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1">{eq.codigo_inventario} • {eq.tipo}</div>
                  <div className="text-sm mt-2">
                    <b>Disp.:</b> {eq.cantidad_disponible}/{eq.cantidad_total}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button size="xs" color="light" onClick={() => nav(`/app/labs/${selLabId}?equipo=${eq.id}`)}>
                      Ver ficha / solicitar
                    </Button>
                    {(me.rol === "admin" || me.rol === "tecnico") && (
                      <Button size="xs" color="light" onClick={() => nav(`/app/labs/${selLabId}#lab-technicians`)}>
                        Técnicos
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* === Sección Laboratorios (CRUD) — Solo admin/técnico === */}
      {canManageLabs && (
        <>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Laboratorios</h3>
            <Button className="bg-primary text-white" onClick={() => setOpenCreate(true)}>
              <Icon icon="solar:add-circle-linear" className="me-2" /> Nuevo laboratorio
            </Button>
          </div>

          <Card>
            {loading ? (
              <p>Cargando…</p>
            ) : err ? (
              <p className="text-red-600">{err}</p>
            ) : labs.length === 0 ? (
              <p className="text-sm text-slate-500">No hay laboratorios todavía. Crea el primero.</p>
            ) : (
              <ul className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {labs.map((l) => (
                  <li key={l.id}>
                    <div
                      className="relative rounded-2xl border p-4 hover:shadow-sm cursor-pointer group"
                      onClick={() => nav(`/app/labs/${l.id}`)}
                    >
                      {/* acciones */}
                      <div className="absolute right-2 top-2 flex gap-1 opacity-0 group-hover:opacity-100 transition">
                        <Tooltip content="Editar">
                          <button
                            className="h-8 w-8 rounded-full bg-lightgray flex items-center justify-center"
                            onClick={(e)=>{e.stopPropagation(); setOpenEdit({open:true, lab:l});}}
                          >
                            <Icon icon="solar:pen-linear" />
                          </button>
                        </Tooltip>
                        <Tooltip content="Eliminar">
                          <button
                            className="h-8 w-8 rounded-full bg-lightgray flex items-center justify-center"
                            onClick={(e)=>{e.stopPropagation(); setOpenDelete({open:true, lab:l});}}
                          >
                            <Icon icon="solar:trash-bin-minimalistic-linear" />
                          </button>
                        </Tooltip>
                        {/* Ir directo a Técnicos */}
                        {(me.rol === "admin" || me.rol === "tecnico") && (
                          <Tooltip content="Gestionar técnicos">
                            <button
                              className="h-8 w-8 rounded-full bg-lightgray flex items-center justify-center"
                              onClick={(e) => {
                                e.stopPropagation();
                                nav(`/app/labs/${l.id}#lab-technicians`);
                              }}
                            >
                              <Icon icon="solar:users-group-linear" />
                            </button>
                          </Tooltip>
                        )}
                      </div>

                      <div className="font-medium">{l.nombre}</div>
                      <div className="text-sm text-slate-600">{l.ubicacion}</div>
                      <div className="text-xs text-slate-400 mt-1">{l.codigo_interno}</div>
                      {l.descripcion && <div className="text-xs text-slate-500 mt-2 line-clamp-2">{l.descripcion}</div>}

                      {/* CTA abajo */}
                      <div className="mt-3 flex gap-2">
                        <Button size="xs" color="light" onClick={(e)=>{ e.stopPropagation(); nav(`/app/labs/${l.id}`); }}>
                          Ver detalle
                        </Button>
                        {(me.rol === "admin" || me.rol === "tecnico") && (
                          <Button size="xs" color="light" onClick={(e)=>{ e.stopPropagation(); nav(`/app/labs/${l.id}#lab-technicians`); }}>
                            Técnicos
                          </Button>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Modales CRUD */}
          <LabForm
            open={openCreate}
            onClose={() => setOpenCreate(false)}
            onSubmit={async (v)=>{ setSubmitting(true); try{ await createLab(v); setOpenCreate(false); await refresh(); } finally { setSubmitting(false); } }}
            submitting={submitting}
            title="Nuevo laboratorio"
          />
          <LabForm
            open={openEdit.open}
            onClose={() => setOpenEdit({open:false})}
            onSubmit={async (v)=>{ if(!openEdit.lab) return; setSubmitting(true); try{ await updateLab(openEdit.lab.id, v); setOpenEdit({open:false}); await refresh(); } finally { setSubmitting(false); } }}
            submitting={submitting}
            title="Editar laboratorio"
            initial={openEdit.lab && {
              nombre: openEdit.lab.nombre,
              codigo_interno: openEdit.lab.codigo_interno,
              ubicacion: openEdit.lab.ubicacion,
              descripcion: openEdit.lab.descripcion ?? "",
            }}
          />
          <ConfirmDialog
            open={openDelete.open}
            onClose={() => setOpenDelete({open:false})}
            onConfirm={async ()=>{ if(!openDelete.lab) return; setSubmitting(true); try{ await deleteLab(openDelete.lab.id); setOpenDelete({open:false}); await refresh(); } finally { setSubmitting(false); } }}
            confirming={submitting}
            title="Eliminar laboratorio"
            message={`¿Eliminar "${openDelete.lab?.nombre}"? Esta acción no se puede deshacer.`}
          />
        </>
      )}
    </div>
  );
}
