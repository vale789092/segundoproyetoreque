// src/components/labs/TechniciansTable.tsx
import React from "react";
import { Plus, Pencil, Trash2, Loader2, RefreshCw } from "lucide-react";
import {
  listLabTechnicians,
  addLabTechnician,
  updateLabTechnician,
  removeLabTechnician,
  type LabTechnician,
} from "@/services/labs";
import { listEligibleTechnicians, type UserMini } from "@/services/users";
import { getUser } from "@/services/storage";

type Props = { labId: string };

export default function TechniciansTable({ labId }: Props): JSX.Element {
  const me = (getUser() ?? {}) as { rol?: "estudiante" | "profesor" | "tecnico" | "admin" };
  const isAdmin = me?.rol === "admin";

  const [items, setItems] = React.useState<LabTechnician[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Crear (con select)
  const [showCreate, setShowCreate] = React.useState(false);
  const [eligible, setEligible] = React.useState<UserMini[]>([]);
  const [eligibleLoading, setEligibleLoading] = React.useState(false);
  const [eligibleErr, setEligibleErr] = React.useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = React.useState("");
  const [createBusy, setCreateBusy] = React.useState(false);
  const [activoInput, setActivoInput] = React.useState(true);
  const [hastaInput, setHastaInput] = React.useState("");

  // Editar
  const [editRow, setEditRow] = React.useState<LabTechnician | null>(null);
  const [editActivo, setEditActivo] = React.useState<boolean>(true);
  const [editHasta, setEditHasta] = React.useState<string>("");
  const [editBusy, setEditBusy] = React.useState(false);

  // Eliminar
  const [removeBusy, setRemoveBusy] = React.useState<string | null>(null);

  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true);
      const data = await listLabTechnicians(labId);
      setItems(Array.isArray(data) ? data : []);
      setError(null);
    } catch (e: any) {
      setError(e?.response?.data?.error ?? e?.message ?? "Error al cargar técnicos");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [labId]);

  React.useEffect(() => { fetchData(); }, [fetchData]);

  // Cargar elegibles cuando abres el modal
  async function openCreate() {
    setShowCreate(true);
    setSelectedUserId("");
    setActivoInput(true);
    setHastaInput("");
    try {
      setEligibleLoading(true);
      setEligibleErr(null);
      const data = await listEligibleTechnicians(labId); // endpoint scoped
      setEligible(data);
    } catch (e: any) {
      setEligibleErr(e?.response?.data?.error ?? e?.message ?? "No se pudo listar técnicos elegibles");
      setEligible([]);
    } finally {
      setEligibleLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUserId) {
      alert("Selecciona un usuario");
      return;
    }
    try {
      setCreateBusy(true);
      await addLabTechnician(labId, {
        usuario_id: selectedUserId,
        activo: !!activoInput,
        asignado_hasta: hastaInput ? new Date(hastaInput).toISOString() : null,
      });
      await fetchData();
      setShowCreate(false);
    } catch (e: any) {
      alert(e?.response?.data?.error ?? e?.message ?? "Error al crear técnico");
    } finally {
      setCreateBusy(false);
    }
  }

  function toYmd(dateIso?: string | null) {
    if (!dateIso) return "";
    const d = new Date(dateIso);
    if (isNaN(d.getTime())) return "";
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${m}-${day}`;
    }

  function handleStartEdit(row: LabTechnician) {
    setEditRow(row);
    setEditActivo(Boolean((row as any).activo));
    setEditHasta(toYmd((row as any).asignado_hasta));
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editRow) return;
    try {
      setEditBusy(true);
      await updateLabTechnician(labId, editRow.id, {
        activo: editActivo,
        asignado_hasta: editHasta ? new Date(editHasta).toISOString() : null,
      });
      await fetchData();
      setEditRow(null);
    } catch (e: any) {
      alert(e?.response?.data?.error ?? e?.message ?? "Error al actualizar técnico");
    } finally {
      setEditBusy(false);
    }
  }

  async function handleRemove(id: string) {
    if (!confirm("¿Eliminar técnico del laboratorio?")) return;
    try {
      setRemoveBusy(id);
      await removeLabTechnician(labId, id);
      await fetchData();
    } catch (e: any) {
      alert(e?.response?.data?.error ?? e?.message ?? "Error al eliminar técnico");
    } finally {
      setRemoveBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Técnicos responsables</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm hover:bg-white/5"
            title="Refrescar"
          >
            <RefreshCw className="h-4 w-4" /> Refrescar
          </button>
          {isAdmin && (
            <button
              onClick={openCreate}
              className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm hover:bg-white/5"
            >
              <Plus className="h-4 w-4" /> Agregar técnico
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm opacity-80">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
        </div>
      ) : error ? (
        <div className="text-sm text-red-500">{error}</div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border p-6 text-sm opacity-80">No hay técnicos asignados.</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="min-w-full text-sm">
            <thead className="bg-white/5">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Nombre</th>
                <th className="px-4 py-3 text-left font-medium">Correo</th>
                <th className="px-4 py-3 text-left font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="px-4 py-3">{(row as any).usuario_nombre ?? "—"}</td>
                  <td className="px-4 py-3">{(row as any).usuario_correo ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleStartEdit(row)}
                        className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 hover:bg-white/5 disabled:opacity-50"
                        title="Editar asignación"
                        disabled={!isAdmin}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleRemove(row.id)}
                        className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 hover:bg-white/5 disabled:opacity-50"
                        disabled={!isAdmin || removeBusy === row.id}
                        title="Eliminar"
                      >
                        {removeBusy === row.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Crear: SOLO select de técnicos elegibles */}
      {showCreate && (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100 p-6 shadow-xl">
            <h4 className="mb-4 text-base font-semibold">Agregar técnico</h4>

            {eligibleLoading ? (
              <div className="flex items-center gap-2 text-sm opacity-80">
                <Loader2 className="h-4 w-4 animate-spin" /> Cargando candidatos…
              </div>
            ) : eligibleErr ? (
              <div className="text-sm text-red-500">{eligibleErr}</div>
            ) : (
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm">Selecciona el usuario</label>
                  <select
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    className="w-full rounded-xl border bg-transparent px-3 py-2 text-sm"
                    required
                  >
                    <option value="">— Selecciona —</option>
                    {eligible.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.nombre} — {u.correo} ({u.rol})
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs opacity-70">
                    Solo aparecen usuarios con rol <b>tecnico</b> (activo) o <b>admin</b>.
                  </p>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <label className="text-sm inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={activoInput}
                      onChange={(e) => setActivoInput(e.target.checked)}
                    />
                    Activo
                  </label>
                  <div className="grow">
                    <label className="mb-1 block text-sm">Asignado hasta (opcional)</label>
                    <input
                      type="date"
                      value={hastaInput}
                      onChange={(e) => setHastaInput(e.target.value)}
                      className="w-full rounded-xl border bg-transparent px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2">
                  <button type="button" onClick={() => setShowCreate(false)} className="rounded-xl border px-3 py-2 text-sm">
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={createBusy}
                    className="rounded-xl bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50"
                  >
                    {createBusy ? "Guardando…" : "Guardar"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Modal Editar */}
      {editRow && (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100 p-6 shadow-xl">
            <h4 className="mb-4 text-base font-semibold">Editar asignación</h4>
            <form onSubmit={handleEdit} className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <label className="text-sm inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editActivo}
                    onChange={(e) => setEditActivo(e.target.checked)}
                  />
                  Activo
                </label>
                <div className="grow">
                  <label className="mb-1 block text-sm">Asignado hasta (opcional)</label>
                  <input
                    type="date"
                    value={editHasta}
                    onChange={(e) => setEditHasta(e.target.value)}
                    className="w-full rounded-xl border bg-transparent px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2">
                <button type="button" onClick={() => setEditRow(null)} className="rounded-xl border px-3 py-2 text-sm">
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={editBusy}
                  className="rounded-xl bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50"
                >
                  {editBusy ? "Guardando…" : "Guardar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
