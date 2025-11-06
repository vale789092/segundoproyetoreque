// views/dashboards/Dashboard.tsx
import { useEffect, useState, useMemo } from "react";
import { Button, Card, Tooltip } from "flowbite-react";
import { Icon } from "@iconify/react";
import { useNavigate } from "react-router";
// añade listMyLabs
import { listLabs, listMyLabs, createLab, updateLab, deleteLab, LabRow } from "@/services/labs";
import LabForm from "@/components/labs/LabForm";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
// importa el usuario actual
import { getUser } from "@/services/storage";

type Me = { id?: string; rol?: string };

export default function Dashboard() {
  const nav = useNavigate();

  // quién soy y qué puedo
  const me = (getUser() ?? {}) as Me;
  const isAdmin = me?.rol === "admin";
  const isTech  = me?.rol === "tecnico";

  const [labs, setLabs] = useState<LabRow[]>([]);
  // ids de labs asignados al técnico
  const [myLabIds, setMyLabIds] = useState<Set<string>>(new Set());

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [openCreate, setOpenCreate] = useState(false);
  const [openEdit, setOpenEdit] = useState<{open:boolean; lab?: LabRow}>({open:false});
  const [openDelete, setOpenDelete] = useState<{open:boolean; lab?: LabRow}>({open:false});
  const [submitting, setSubmitting] = useState(false);

  // helpers de permiso por lab
  const canCreate = isAdmin;
  const canEditLab   = (l: LabRow) => isAdmin || (isTech && myLabIds.has(l.id));
  const canDeleteLab = (_l: LabRow) => isAdmin;

  async function refresh() {
    setLoading(true);
    setErr(null);
    try {
      const all = await listLabs();

      // si es técnico, intenta traer sólo los suyos
      let mine: LabRow[] = [];
      if (isTech) {
        try { mine = await listMyLabs(); } catch { /* si no existe ?mine en backend, ignora */ }
      }

      setLabs(all);
      setMyLabIds(new Set(mine.map(m => m.id)));
    } catch (e:any) {
      setErr(e?.message ?? "Error cargando laboratorios");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, []);

  // crear
  const handleCreate = async (values: any) => {
    setSubmitting(true);
    try {
      await createLab(values);
      setOpenCreate(false);
      await refresh();
    } catch (e:any) {
      alert(e?.message ?? "No se pudo crear");
    } finally { setSubmitting(false); }
  };

  // editar
  const handleEdit = async (values: any) => {
    if (!openEdit.lab) return;
    // doble check de permiso por si alguien forza el UI
    if (!canEditLab(openEdit.lab)) { alert("No tienes permisos para editar este laboratorio."); return; }
    setSubmitting(true);
    try {
      await updateLab(openEdit.lab.id, values);
      setOpenEdit({open:false});
      await refresh();
    } catch (e:any) {
      alert(e?.message ?? "No se pudo actualizar");
    } finally { setSubmitting(false); }
  };

  // eliminar
  const handleDelete = async () => {
    if (!openDelete.lab) return;
    if (!canDeleteLab(openDelete.lab)) { alert("No tienes permisos para eliminar."); return; }
    setSubmitting(true);
    try {
      await deleteLab(openDelete.lab.id);
      setOpenDelete({open:false});
      await refresh();
    } catch (e:any) {
      alert(e?.message ?? "No se pudo eliminar");
    } finally { setSubmitting(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Laboratorios</h3>

        {/* crear sólo si admin */}
        {canCreate && (
          <Button className="bg-primary text-white" onClick={() => setOpenCreate(true)}>
            <Icon icon="solar:add-circle-linear" className="me-2" /> Nuevo laboratorio
          </Button>
        )}
      </div>

      <Card>
        {loading ? (
          <p>Cargando…</p>
        ) : err ? (
          <p className="text-red-600">{err}</p>
        ) : labs.length === 0 ? (
          <p className="text-sm text-slate-500">No hay laboratorios todavía.</p>
        ) : (
          <ul className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {labs.map((l) => {
              const canEdit = canEditLab(l);
              const canDel  = canDeleteLab(l);
              return (
                <li key={l.id}>
                  <div
                    className="relative rounded-2xl border p-4 hover:shadow-sm cursor-pointer group"
                    onClick={() => nav(`/app/labs/${l.id}`)}
                  >
                    {/* acciones condicionadas */}
                    {(canEdit || canDel) && (
                      <div className="absolute right-2 top-2 flex gap-1 opacity-0 group-hover:opacity-100 transition">
                        {canEdit && (
                          <Tooltip content="Editar">
                            <button
                              className="h-8 w-8 rounded-full bg-lightgray flex items-center justify-center"
                              onClick={(e)=>{e.stopPropagation(); setOpenEdit({open:true, lab:l});}}
                            >
                              <Icon icon="solar:pen-linear" />
                            </button>
                          </Tooltip>
                        )}
                        {canDel && (
                          <Tooltip content="Eliminar">
                            <button
                              className="h-8 w-8 rounded-full bg-lightgray flex items-center justify-center"
                              onClick={(e)=>{e.stopPropagation(); setOpenDelete({open:true, lab:l});}}
                            >
                              <Icon icon="solar:trash-bin-minimalistic-linear" />
                            </button>
                          </Tooltip>
                        )}
                      </div>
                    )}

                    <div className="font-medium">{l.nombre}</div>
                    <div className="text-sm text-slate-600">{l.ubicacion}</div>
                    <div className="text-xs text-slate-400 mt-1">{l.codigo_interno}</div>
                    {l.descripcion && <div className="text-xs text-slate-500 mt-2 line-clamp-2">{l.descripcion}</div>}

                    {/* badge opcional si el técnico NO tiene permiso */}
                    {isTech && !myLabIds.has(l.id) && (
                      <div className="mt-2 text-[11px] text-slate-400 italic">Solo lectura</div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* Modales */}
      <LabForm
        open={openCreate}
        onClose={() => setOpenCreate(false)}
        onSubmit={handleCreate}
        submitting={submitting}
        title="Nuevo laboratorio"
      />

      <LabForm
        open={openEdit.open}
        onClose={() => setOpenEdit({open:false})}
        onSubmit={handleEdit}
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
        onConfirm={handleDelete}
        confirming={submitting}
        title="Eliminar laboratorio"
        message={`¿Eliminar "${openDelete.lab?.nombre}"? Esta acción no se puede deshacer.`}
      />
    </div>
  );
}
