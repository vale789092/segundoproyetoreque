// src/views/operacion/Mantenimientos.tsx
import { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  Card,
  Label,
  Modal,
  Select,
  Tabs,
  Textarea,
  TextInput,
  ToggleSwitch,
} from "flowbite-react";
import { Icon } from "@iconify/react";
import { useNavigate } from "react-router";
import { getUser } from "@/services/storage";
import {
  listLabs,
  type LabRow,
  listEquiposByCriteria,
  type EquipoRow,
} from "@/services/labs";
import {
  addResources,
  createMaintenance,
  listMaintenances,
  removeResource,
  localToISO,
  type MantTipo,
  type MaintenanceRow,
  // 👇 nuevo
  getMaintenance,
} from "@/services/mantenimientos";

type Rol = "estudiante" | "profesor" | "tecnico" | "admin";
const TIPOS: MantTipo[] = ["preventivo", "correctivo", "calibracion", "inspeccion", "otro"];

// util: date -> ISO 00:00 local
function startOfDayISO(d?: string) {
  if (!d) return undefined;
  const x = new Date(d + "T00:00");
  return x.toISOString();
}
function addDaysISO(d?: string, days?: number) {
  if (!d || !Number.isFinite(days)) return undefined;
  const x = new Date(d + "T00:00");
  x.setDate(x.getDate() + (days || 0));
  return x.toISOString();
}
function nowLocalForInput() {
  const n = new Date();
  n.setMinutes(n.getMinutes() - n.getTimezoneOffset());
  return n.toISOString().slice(0, 16);
}

export default function Mantenimientos() {
  const nav = useNavigate();
  const me = (getUser() ?? {}) as { id?: string; rol?: Rol };
  const isTech = me.rol === "tecnico" || me.rol === "admin";

  // -------- filtros/listado ----------
  const [labs, setLabs] = useState<LabRow[]>([]);
  const [labId, setLabId] = useState<string>("");
  const [desde, setDesde] = useState<string>("");
  const [hasta, setHasta] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<MaintenanceRow[]>([]);

  // -------- crear ----------
  const [tipo, setTipo] = useState<MantTipo>("preventivo");
  const [programado, setProgramado] = useState<string>(nowLocalForInput());
  const [proc, setProc] = useState("");
  const [obs, setObs] = useState("");
  const [equipos, setEquipos] = useState<EquipoRow[]>([]);
  const [soloDisp, setSoloDisp] = useState(true);
  const [selEquipos, setSelEquipos] = useState<Record<string, boolean>>({});
  const [sending, setSending] = useState(false);

  // -------- modal: agregar equipos a mantenimiento existente ----------
  const [openEditRec, setOpenEditRec] = useState<{ open: boolean; row?: MaintenanceRow }>({
    open: false,
  });

  // -------- modal: administrar/quitar equipos ----------
  const [equiposModal, setEquiposModal] = useState<{
    open: boolean;
    row?: MaintenanceRow;
    loading: boolean;
    recursos: { id: string; nombre: string }[];
    removingId?: string | null;
  }>({ open: false, loading: false, recursos: [] });

  // cargar labs una vez
  useEffect(() => {
    (async () => {
      try {
        const ls = await listLabs();
        setLabs(ls);
        if (!labId && ls[0]) setLabId(ls[0].id);
      } catch {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // cargar listado
  async function refreshList() {
    if (!labId) return;
    setLoading(true);
    try {
      const arr = await listMaintenances({
        laboratorio_id: labId,
        desde: startOfDayISO(desde),
        hasta: addDaysISO(hasta, 1), // exclusivo
        limit: 100,
        offset: 0,
      });
      setRows(arr);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    refreshList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [labId, desde, hasta]);

  // cargar equipos seleccionables
  async function refreshEquipos() {
    if (!labId) {
      setEquipos([]);
      return;
    }
    try {
      const arr = await listEquiposByCriteria({
        labId,
        soloDisponibles: soloDisp ? true : undefined,
      });
      setEquipos(arr.filter((e) => e.estado_disp !== "en_mantenimiento"));
      setSelEquipos({});
    } catch {
      setEquipos([]);
      setSelEquipos({});
    }
  }
  useEffect(() => {
    refreshEquipos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [labId, soloDisp]);

  const selectedIds = useMemo(
    () => Object.entries(selEquipos).filter(([, v]) => v).map(([k]) => k),
    [selEquipos]
  );

  // crear mantenimiento
  async function handleCreate() {
    if (!isTech) return alert("No autorizado");
    if (!labId) return alert("Selecciona un laboratorio");
    if (!me.id) return alert("No se encontró el técnico en la sesión");
    if (!programado) return alert("Selecciona fecha/hora");
    if (selectedIds.length === 0) return alert("Selecciona al menos un equipo");

    setSending(true);
    try {
      await createMaintenance({
        programado_para: localToISO(programado),
        tipo,
        tecnico_id: me.id!,
        procedimientos: proc || null,
        observaciones: obs || null,
        repuestos_usados: null,
        equipo_ids: selectedIds,
      });
      setProc("");
      setObs("");
      setSelEquipos({});
      await refreshEquipos();
      await refreshList();
      alert("Mantenimiento creado");
    } catch (e: any) {
      alert(e?.message ?? "Error creando mantenimiento");
    } finally {
      setSending(false);
    }
  }

  // agregar equipos a mantenimiento existente
  async function handleAddRecursos() {
    if (!openEditRec.row) return;
    if (selectedIds.length === 0) return;
    try {
      await addResources(openEditRec.row.id, selectedIds);
      setOpenEditRec({ open: false });
      await refreshList();
      alert("Recursos agregados");
    } catch (e: any) {
      alert(e?.message ?? "No se pudo agregar recursos");
    }
  }

  // abrir modal de administración de equipos (ver / quitar)
  async function openEquiposModal(row: MaintenanceRow) {
    setEquiposModal({ open: true, row, loading: true, recursos: [] });
    try {
      const detail = await getMaintenance(row.id);
      const recursos = (detail?.recursos || []).map((r: any) => ({ 
        id: r?.id ?? "", 
        nombre: r?.nombre ?? "Sin nombre" 
      }));
      setEquiposModal((s) => ({ ...s, loading: false, recursos }));
    } catch {
      setEquiposModal((s) => ({ ...s, loading: false, recursos: [] }));
    }
  }

  // quitar equipo
  async function handleRemoveEquipo(equipoId: string) {
    const r = equiposModal.row;
    if (!r) return;
    if (!confirm("¿Quitar este equipo del mantenimiento?")) return;
    try {
      setEquiposModal((s) => ({ ...s, removingId: equipoId }));
      await removeResource(r.id, equipoId);
      // actualizar modal y listado
      setEquiposModal((s) => ({
        ...s,
        recursos: s.recursos.filter((x) => x.id !== equipoId),
        removingId: null,
      }));
      await refreshList();
    } catch (e: any) {
      alert(e?.message ?? "No se pudo quitar el recurso");
      setEquiposModal((s) => ({ ...s, removingId: null }));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Mantenimientos</h2>
        <Button color="light" onClick={() => nav("/")}>
          <Icon icon="solar:home-linear" className="me-2" />
          Inicio
        </Button>
      </div>

      {/* Filtros del listado */}
      <Card>
        <div className="grid grid-cols-12 gap-4 items-end">
          <div className="col-span-12 md:col-span-4">
            <Label value="Laboratorio" />
            <Select value={labId} onChange={(e) => setLabId(e.target.value)}>
              {labs.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nombre} — {l.ubicacion}
                </option>
              ))}
            </Select>
          </div>
          <div className="col-span-6 md:col-span-3">
            <Label value="Desde" />
            <TextInput type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
          </div>
          <div className="col-span-6 md:col-span-3">
            <Label value="Hasta" />
            <TextInput type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </div>
          <div className="col-span-12 md:col-span-2 flex justify-end">
            <Button onClick={refreshList} isProcessing={loading} disabled={!labId || loading}>
              <Icon icon="solar:refresh-linear" className="me-2" />
              Actualizar
            </Button>
          </div>
        </div>
      </Card>

      <Tabs aria-label="tabs">
        {/* PROGRAMAR */}
        <Tabs.Item title="Programar" active>
          <Card>
            {!isTech ? (
              <p className="text-sm text-slate-500">
                Solo técnicos/administradores pueden programar mantenimientos.
              </p>
            ) : (
              <>
                <div className="grid grid-cols-12 gap-4">
                  <div className="col-span-12 md:col-span-4">
                    <Label value="Laboratorio" />
                    <Select value={labId} onChange={(e) => setLabId(e.target.value)}>
                      {labs.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.nombre} — {l.ubicacion}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div className="col-span-12 md:col-span-4">
                    <Label value="Fecha/Hora" />
                    <TextInput
                      type="datetime-local"
                      value={programado}
                      onChange={(e) => setProgramado(e.target.value)}
                    />
                  </div>

                  <div className="col-span-12 md:col-span-4">
                    <Label value="Tipo" />
                    <Select value={tipo} onChange={(e) => setTipo(e.target.value as MantTipo)}>
                      {TIPOS.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div className="col-span-12 md:col-span-6">
                    <Label value="Procedimientos (opcional)" />
                    <Textarea rows={3} value={proc} onChange={(e) => setProc(e.target.value)} />
                  </div>

                  <div className="col-span-12 md:col-span-6">
                    <Label value="Observaciones (opcional)" />
                    <Textarea rows={3} value={obs} onChange={(e) => setObs(e.target.value)} />
                  </div>
                </div>

                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <Label value="Seleccionar equipos" />
                    <ToggleSwitch checked={soloDisp} label="Solo disponibles" onChange={setSoloDisp} />
                  </div>

                  {equipos.length === 0 ? (
                    <p className="text-sm text-slate-500">No hay equipos para seleccionar.</p>
                  ) : (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {equipos.map((eq) => (
                        <label
                          key={eq.id}
                          className={`border rounded-xl p-3 flex gap-3 cursor-pointer hover:shadow-sm ${
                            selEquipos[eq.id] ? "ring-2 ring-primary/60" : ""
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="mt-1"
                            checked={!!selEquipos[eq.id]}
                            onChange={(e) =>
                              setSelEquipos((s) => ({ ...s, [eq.id]: e.target.checked }))
                            }
                          />
                          <div className="flex-1">
                            <div className="font-medium">{eq.nombre}</div>
                            <div className="text-xs text-slate-500">
                              {eq.codigo_inventario} • {eq.tipo}
                            </div>
                            <div className="text-xs mt-1">
                              <Badge color={eq.estado_disp === "disponible" ? "success" : "warning"}>
                                {eq.estado_disp}
                              </Badge>
                              <span className="ms-2 text-slate-500">
                                {eq.cantidad_disponible}/{eq.cantidad_total}
                              </span>
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-6 flex justify-end">
                  <Button
                    className="bg-primary text-white"
                    onClick={handleCreate}
                    isProcessing={sending}
                    disabled={sending || !labId || !programado || selectedIds.length === 0}
                  >
                    <Icon icon="solar:wrench-linear" className="me-2" />
                    Programar mantenimiento
                  </Button>
                </div>
              </>
            )}
          </Card>
        </Tabs.Item>

        {/* LISTADO */}
        <Tabs.Item title="Listado">
          <Card>
            {loading ? (
              <p>Cargando…</p>
            ) : rows.length === 0 ? (
              <p className="text-sm text-slate-500">Sin registros.</p>
            ) : (
              <div className="space-y-3">
                {rows.map((r) => (
                  <div key={r.id} className="border rounded-xl p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold">
                          {new Date(r.programado_para).toLocaleString()} — {r.tipo}
                        </div>
                        <div className="text-xs text-slate-500">Técnico: {r.tecnico_id}</div>
                        <div className="text-xs text-slate-600 mt-1">
                          Recursos vinculados: <b>{(r as any).recursos_count ?? 0}</b>
                        </div>
                      </div>

                      {isTech && (
                        <div className="flex gap-2">
                          <Button
                            size="xs"
                            color="light"
                            onClick={() => setOpenEditRec({ open: true, row: r })}
                          >
                            <Icon icon="solar:add-circle-linear" className="me-1" />
                            Agregar equipos
                          </Button>
                          <Button
                            size="xs"
                            color="light"
                            onClick={() => openEquiposModal(r)}
                          >
                            <Icon icon="solar:settings-outline" className="me-1" />
                            Administrar equipos
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </Tabs.Item>
      </Tabs>

      {/* Modal: agregar recursos */}
      <Modal show={openEditRec.open} onClose={() => setOpenEditRec({ open: false })} size="lg">
        <Modal.Header>Agregar equipos</Modal.Header>
        <Modal.Body>
          <div className="flex items-center justify-between mb-2">
            <Label value="Selecciona equipos del laboratorio" />
            <ToggleSwitch checked={soloDisp} label="Solo disponibles" onChange={setSoloDisp} />
          </div>

          {equipos.length === 0 ? (
            <p className="text-sm text-slate-500">No hay equipos disponibles.</p>
          ) : (
            <div className="grid md:grid-cols-2 gap-3">
              {equipos.map((eq) => (
                <label
                  key={eq.id}
                  className={`border rounded-xl p-3 flex gap-3 cursor-pointer ${
                    selEquipos[eq.id] ? "ring-2 ring-primary/60" : ""
                  }`}
                >
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={!!selEquipos[eq.id]}
                    onChange={(e) =>
                      setSelEquipos((s) => ({ ...s, [eq.id]: e.target.checked }))
                    }
                  />
                  <div className="flex-1">
                    <div className="font-medium">{eq.nombre}</div>
                    <div className="text-xs text-slate-500">
                      {eq.codigo_inventario} • {eq.tipo}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button color="gray" onClick={() => setOpenEditRec({ open: false })}>
            Cancelar
          </Button>
          <Button onClick={handleAddRecursos} disabled={selectedIds.length === 0}>
            <Icon icon="solar:check-circle-linear" className="me-2" />
            Agregar
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal: administrar/quitar recursos */}
      <Modal
        show={equiposModal.open}
        onClose={() => setEquiposModal({ open: false, loading: false, recursos: [] })}
        size="lg"
      >
        <Modal.Header>Equipos del mantenimiento</Modal.Header>
        <Modal.Body>
          {equiposModal.loading ? (
            <p className="text-sm text-slate-500">Cargando…</p>
          ) : equiposModal.recursos.length === 0 ? (
            <p className="text-sm text-slate-500">Este mantenimiento no tiene equipos vinculados.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {equiposModal.recursos.map((e) => (
                <span
                  key={e.id}
                  className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-100 text-sky-800 text-xs"
                >
                  {e.nombre}
                  <button
                    className="text-sky-700 hover:text-sky-900 disabled:opacity-50"
                    onClick={() => handleRemoveEquipo(e.id)}
                    disabled={equiposModal.removingId === e.id}
                    title="Quitar del mantenimiento"
                  >
                    <Icon icon="solar:close-circle-linear" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button color="gray" onClick={() => setEquiposModal({ open: false, loading: false, recursos: [] })}>
            Cerrar
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
