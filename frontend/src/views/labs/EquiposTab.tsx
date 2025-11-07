// EquiposTab.tsx
import React from "react";
import { Card, Button, Badge } from "flowbite-react";
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react";
import { getUser } from "@/services/storage";
import {
  listEquipos,
  type EquipoRow,
  createEquipoAPI,
  updateEquipoAPI,
  deleteEquipoAPI,
} from "@/services/labs";

type Props = { labId: string };

export default function EquiposTab({ labId }: Props) {
  const me = (getUser() ?? {}) as { rol?: "estudiante"|"profesor"|"tecnico"|"admin" };
  const canRequest = me?.rol === "estudiante" || me?.rol === "profesor"; // solo estos ven el CTA
  const canManage = me.rol === "admin";

  const [items, setItems] = React.useState<EquipoRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string|null>(null);

  const [showCreate, setShowCreate] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [removeBusy, setRemoveBusy] = React.useState<string|null>(null);

  const [form, setForm] = React.useState({
    codigo_inventario: "",
    nombre: "",
    tipo: "equipo" as "equipo"|"material"|"software",
    estado_operativo: "operativo" as "operativo"|"fuera_servicio"|"baja",
    estado_disp: "disponible" as "disponible"|"reservado"|"en_mantenimiento"|"inactivo",
    reservable: true,
    cantidad_total: 1,
    cantidad_disponible: 1,
  });

  async function refresh() {
    try {
      setLoading(true); setError(null);
      const rows = await listEquipos(labId);
      setItems(Array.isArray(rows)? rows: []);
    } catch (e:any) {
      setError(e?.response?.data?.error ?? e?.message ?? "Error al cargar equipos");
    } finally { setLoading(false); }
  }
  React.useEffect(()=>{ refresh(); }, [labId]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      setBusy(true);
      await createEquipoAPI(labId, form as any);
      setShowCreate(false);
      await refresh();
    } catch (e:any) {
      alert(e?.response?.data?.error ?? e?.message ?? "No se pudo crear equipo");
    } finally { setBusy(false); }
  }

  async function handleInlineUpdate(id: string, patch: Partial<EquipoRow>) {
    try {
      setBusy(true);
      await updateEquipoAPI(labId, id, patch);
      await refresh();
    } catch (e:any) {
      alert(e?.response?.data?.error ?? e?.message ?? "No se pudo actualizar");
    } finally { setBusy(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este equipo?")) return;
    try {
      setRemoveBusy(id);
      await deleteEquipoAPI(labId, id);
      await refresh();
    } catch (e:any) {
      alert(e?.response?.data?.error ?? e?.message ?? "No se pudo eliminar");
    } finally { setRemoveBusy(null); }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold">Equipos</h4>
        {canManage && (
          <Button color="light" onClick={()=>{ setShowCreate(true); }}>
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
        <p className="text-sm text-slate-500">No hay equipos registrados.</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map(eq => (
            <Card key={eq.id} className="rounded-2xl">
              <div className="flex items-start justify-between">
                <div>
                  <h5 className="font-medium">{eq.nombre}</h5>
                  <p className="text-xs text-slate-500">{eq.codigo_inventario} • {eq.tipo}</p>
                </div>
                <Badge color={
                  eq.estado_disp === "disponible" ? "green" :
                  eq.estado_disp === "reservado" ? "yellow" :
                  eq.estado_disp === "en_mantenimiento" ? "blue" : "gray"
                }>
                  {eq.estado_disp}
                </Badge>
              </div>

              <div className="mt-2 text-sm">
                <b>Disp.:</b> {eq.cantidad_disponible}/{eq.cantidad_total}
              </div>

              <div className="mt-3 flex items-center gap-2">
                <Button color="light" size="xs" onClick={()=>window.location.assign(`/app/labs/${labId}?equipo=${eq.id}`)}>
                  Ver ficha / solicitar
                </Button>
                {canManage && (
                  <>
                    <Button color="light" size="xs"
                      onClick={()=>handleInlineUpdate(eq.id, { estado_disp: eq.estado_disp === "disponible" ? "inactivo":"disponible" })}>
                      <Pencil className="h-4 w-4 mr-1"/> Toggle disp.
                    </Button>
                    <Button color="light" size="xs" onClick={()=>handleDelete(eq.id)} disabled={removeBusy===eq.id}>
                      {removeBusy===eq.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <Trash2 className="h-4 w-4 mr-1" />}
                      Eliminar
                    </Button>
                  </>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Modal crear */}
      {showCreate && (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border bg-white dark:bg-slate-900 p-6">
            <h5 className="font-semibold mb-4">Agregar equipo</h5>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="text-sm">Código inventario*</label>
                <input
                    className="w-full rounded-xl border px-3 py-2 text-sm bg-transparent"
                    value={form.codigo_inventario}
                    onChange={(e)=>setForm({...form, codigo_inventario:e.target.value})}
                    placeholder="p. ej. EQ-OSC-001"
                />
              </div>
              <div>
                <label className="text-sm">Nombre*</label>
                <input
                    className="w-full rounded-xl border px-3 py-2 text-sm bg-transparent"
                    value={form.nombre}
                    onChange={(e)=>setForm({...form, nombre:e.target.value})}
                    placeholder="p. ej. Osciloscopio Tektronix 100MHz"
                />
              </div>
              <div className="flex gap-3">
                <div className="grow">
                  <label className="text-sm">Tipo</label>
                  <select className="w-full rounded-xl border px-3 py-2 text-sm bg-transparent"
                    value={form.tipo} onChange={(e)=>setForm({...form,tipo:e.target.value as any})}>
                    <option value="equipo">equipo</option>
                    <option value="material">material</option>
                    <option value="software">software</option>
                  </select>
                </div>
                <div className="grow">
                  <label className="text-sm">Estado operativo</label>
                  <select className="w-full rounded-xl border px-3 py-2 text-sm bg-transparent"
                    value={form.estado_operativo} onChange={(e)=>setForm({...form,estado_operativo:e.target.value as any})}>
                    <option value="operativo">operativo</option>
                    <option value="fuera_servicio">fuera_servicio</option>
                    <option value="baja">baja</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="grow">
                  <label className="text-sm">Estado disp.</label>
                  <select className="w-full rounded-xl border px-3 py-2 text-sm bg-transparent"
                    value={form.estado_disp} onChange={(e)=>setForm({...form,estado_disp:e.target.value as any})}>
                    <option value="disponible">disponible</option>
                    <option value="reservado">reservado</option>
                    <option value="en_mantenimiento">en_mantenimiento</option>
                    <option value="inactivo">inactivo</option>
                  </select>
                </div>
                <label className="text-sm inline-flex items-center gap-2">
                  <input type="checkbox" checked={form.reservable}
                    onChange={(e)=>setForm({...form,reservable:e.target.checked})}/>
                  Reservable
                </label>
              </div>

              <div className="flex gap-3">
                <div className="grow">
                  <label className="text-sm">Cantidad total</label>
                  <input type="number" min={1} className="w-full rounded-xl border px-3 py-2 text-sm bg-transparent"
                    value={form.cantidad_total} onChange={(e)=>setForm({...form,cantidad_total:Number(e.target.value)})}/>
                </div>
                <div className="grow">
                  <label className="text-sm">Disponible</label>
                  <input type="number" min={0} className="w-full rounded-xl border px-3 py-2 text-sm bg-transparent"
                    value={form.cantidad_disponible} onChange={(e)=>setForm({...form,cantidad_disponible:Number(e.target.value)})}/>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button color="light" type="button" onClick={()=>setShowCreate(false)}>Cancelar</Button>
                <Button type="submit" disabled={busy}>{busy ? "Guardando…" : "Guardar"}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
