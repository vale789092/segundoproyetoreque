import React from "react";
import { Card, Badge, Button } from "flowbite-react";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import {
  listLabPolicies,
  createLabPolicy,
  updateLabPolicy,
  deleteLabPolicy,
  type LabPolicy,
} from "@/services/labs";
import { getUser } from "@/services/storage";

type Props = { labId: string };

const emptyForm: Omit<LabPolicy, "id"> = {
  nombre: "",
  descripcion: "",
  tipo: "otro",
  obligatorio: true,
  vigente_desde: null,
  vigente_hasta: null,
};

export default function PoliciesTab({ labId }: Props) {
  const me = (getUser() ?? {}) as { rol?: "estudiante"|"profesor"|"tecnico"|"admin" };
  const isAdmin = me?.rol === "admin";

  const [items, setItems] = React.useState<LabPolicy[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string|null>(null);

  // crear
  const [showCreate, setShowCreate] = React.useState(false);
  const [createBusy, setCreateBusy] = React.useState(false);
  const [form, setForm] = React.useState<Omit<LabPolicy, "id">>(emptyForm);

  // editar
  const [editItem, setEditItem] = React.useState<LabPolicy | null>(null);
  const [editBusy, setEditBusy] = React.useState(false);

  // borrar
  const [removeBusy, setRemoveBusy] = React.useState<string | null>(null);

  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const rows = await listLabPolicies(labId);
      setItems(Array.isArray(rows) ? rows : []);
    } catch (e: any) {
      setError(e?.response?.data?.error ?? e?.message ?? "Error al cargar políticas");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [labId]);

  React.useEffect(() => { fetchData(); }, [fetchData]);

  function toISO(dateStr?: string | null) {
    if (!dateStr) return null;
    try { return new Date(dateStr).toISOString(); } catch { return null; }
  }
  function fromISO(iso?: string | null) {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toISOString().slice(0,10);
  }

  // CREATE
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nombre?.trim()) return alert("El nombre es requerido");
    try {
      setCreateBusy(true);
      await createLabPolicy(labId, {
        ...form,
        vigente_desde: toISO(form.vigente_desde as any),
        vigente_hasta: toISO(form.vigente_hasta as any),
      });
      setShowCreate(false);
      setForm(emptyForm);
      await fetchData();
    } catch (e: any) {
      alert(e?.response?.data?.error ?? e?.message ?? "No se pudo crear la política");
    } finally {
      setCreateBusy(false);
    }
  }

  // EDIT
  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editItem) return;
    try {
      setEditBusy(true);
      await updateLabPolicy(labId, editItem.id, {
        nombre: editItem.nombre,
        descripcion: editItem.descripcion,
        tipo: editItem.tipo,
        obligatorio: editItem.obligatorio,
        vigente_desde: toISO(editItem.vigente_desde),
        vigente_hasta: toISO(editItem.vigente_hasta),
      });
      setEditItem(null);
      await fetchData();
    } catch (e: any) {
      alert(e?.response?.data?.error ?? e?.message ?? "No se pudo actualizar");
    } finally {
      setEditBusy(false);
    }
  }

  // DELETE
  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar esta política?")) return;
    try {
      setRemoveBusy(id);
      await deleteLabPolicy(labId, id);
      await fetchData();
    } catch (e: any) {
      alert(e?.response?.data?.error ?? e?.message ?? "No se pudo eliminar");
    } finally {
      setRemoveBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold">Políticas</h4>
        {isAdmin && (
          <Button color="light" onClick={() => { setForm(emptyForm); setShowCreate(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Agregar
          </Button>
        )}
      </div>

      {loading ? (
        <p className="text-sm opacity-80 inline-flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin"/> Cargando…
        </p>
      ) : error ? (
        <p className="text-sm text-red-500">{error}</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-500">Este laboratorio no tiene políticas publicadas.</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map((p) => (
            <Card key={p.id} className="rounded-2xl">
              <div className="flex items-center justify-between">
                <h5 className="font-medium">{p.nombre ?? "Política"}</h5>
                <Badge color={p.tipo === "seguridad" ? "red" : p.tipo === "academico" ? "indigo" : "gray"}>
                  {p.tipo ?? "otro"}
                </Badge>
              </div>

              {p.descripcion && <p className="text-sm text-slate-600">{p.descripcion}</p>}

              <div className="mt-2 text-xs text-slate-500 space-x-2">
                <Badge color={p.obligatorio ? "blue" : "gray"}>
                  {p.obligatorio ? "Obligatorio" : "Opcional"}
                </Badge>
                {p.vigente_desde && <span>Desde: {new Date(p.vigente_desde).toLocaleDateString()}</span>}
                {p.vigente_hasta && <span>Hasta: {new Date(p.vigente_hasta).toLocaleDateString()}</span>}
              </div>

              {isAdmin && (
                <div className="mt-3 flex items-center gap-2">
                  <Button color="light" size="xs" onClick={() => setEditItem(p)}>
                    <Pencil className="h-4 w-4 mr-1" /> Editar
                  </Button>
                  <Button color="light" size="xs" onClick={() => handleDelete(p.id)} disabled={removeBusy === p.id}>
                    {removeBusy === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1" />}
                    Eliminar
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Modal crear */}
      {showCreate && (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border bg-white dark:bg-slate-900 p-6">
            <h5 className="font-semibold mb-4">Agregar política</h5>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="text-sm">Nombre*</label>
                <input className="w-full rounded-xl border px-3 py-2 text-sm bg-transparent"
                  value={form.nombre}
                  onChange={(e)=>setForm({...form, nombre:e.target.value})}
                  required />
              </div>
              <div>
                <label className="text-sm">Descripción</label>
                <textarea className="w-full rounded-xl border px-3 py-2 text-sm bg-transparent"
                  value={form.descripcion ?? ""}
                  onChange={(e)=>setForm({...form, descripcion:e.target.value})} />
              </div>
              <div className="flex gap-3">
                <div className="grow">
                  <label className="text-sm">Tipo</label>
                  <select
                    className="w-full rounded-xl border px-3 py-2 text-sm bg-transparent"
                    value={form.tipo}
                    onChange={(e)=>setForm({...form, tipo: e.target.value as any})}
                  >
                    <option value="seguridad">seguridad</option>
                    <option value="academico">academico</option>
                    <option value="otro">otro</option>
                  </select>
                </div>
                <label className="text-sm inline-flex items-center gap-2">
                  <input type="checkbox"
                    checked={form.obligatorio}
                    onChange={(e)=>setForm({...form, obligatorio:e.target.checked})}/>
                  Obligatorio
                </label>
              </div>
              <div className="flex gap-3">
                <div className="grow">
                  <label className="text-sm">Desde</label>
                  <input type="date" className="w-full rounded-xl border px-3 py-2 text-sm bg-transparent"
                    value={fromISO(form.vigente_desde)}
                    onChange={(e)=>setForm({...form, vigente_desde: e.target.value})}/>
                </div>
                <div className="grow">
                  <label className="text-sm">Hasta</label>
                  <input type="date" className="w-full rounded-xl border px-3 py-2 text-sm bg-transparent"
                    value={fromISO(form.vigente_hasta)}
                    onChange={(e)=>setForm({...form, vigente_hasta: e.target.value})}/>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button color="light" type="button" onClick={()=>setShowCreate(false)}>Cancelar</Button>
                <Button color="light" type="submit" disabled={createBusy}>
                  {createBusy ? "Guardando…" : "Guardar"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal editar */}
      {editItem && (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border bg-white dark:bg-slate-900 p-6">
            <h5 className="font-semibold mb-4">Editar política</h5>
            <form onSubmit={handleEdit} className="space-y-3">
              <div>
                <label className="text-sm">Nombre*</label>
                <input className="w-full rounded-xl border px-3 py-2 text-sm bg-transparent"
                  value={editItem.nombre}
                  onChange={(e)=>setEditItem({...editItem, nombre:e.target.value})}
                  required />
              </div>
              <div>
                <label className="text-sm">Descripción</label>
                <textarea className="w-full rounded-xl border px-3 py-2 text-sm bg-transparent"
                  value={editItem.descripcion ?? ""}
                  onChange={(e)=>setEditItem({...editItem, descripcion:e.target.value})}/>
              </div>
              <div className="flex gap-3">
                <div className="grow">
                  <label className="text-sm">Tipo</label>
                  <select
                    className="w-full rounded-xl border px-3 py-2 text-sm bg-transparent"
                    value={editItem.tipo}
                    onChange={(e)=>setEditItem({...editItem, tipo: e.target.value as any})}
                  >
                    <option value="seguridad">seguridad</option>
                    <option value="academico">academico</option>
                    <option value="otro">otro</option>
                  </select>
                </div>
                <label className="text-sm inline-flex items-center gap-2">
                  <input type="checkbox"
                    checked={editItem.obligatorio}
                    onChange={(e)=>setEditItem({...editItem, obligatorio:e.target.checked})}/>
                  Obligatorio
                </label>
              </div>
              <div className="flex gap-3">
                <div className="grow">
                  <label className="text-sm">Desde</label>
                  <input type="date" className="w-full rounded-xl border px-3 py-2 text-sm bg-transparent"
                    value={fromISO(editItem.vigente_desde)}
                    onChange={(e)=>setEditItem({...editItem, vigente_desde: e.target.value})}/>
                </div>
                <div className="grow">
                  <label className="text-sm">Hasta</label>
                  <input type="date" className="w-full rounded-xl border px-3 py-2 text-sm bg-transparent"
                    value={fromISO(editItem.vigente_hasta)}
                    onChange={(e)=>setEditItem({...editItem, vigente_hasta: e.target.value})}/>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button color="light" type="button" onClick={()=>setEditItem(null)}>Cancelar</Button>
                <Button color="light" type="submit" disabled={editBusy}>{editBusy ? "Guardando…" : "Guardar"}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
