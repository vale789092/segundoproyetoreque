import { useEffect, useState } from "react";
import { Button, Label, Select, TextInput } from "flowbite-react";
import { useNavigate } from "react-router";
import { me, updateMe } from "@/services";                         // ← debe exisitir updateMe(payload)
import { getToken } from "@/services/storage";
import {
  getUser as getStoredUser,
  setUser as setStoredUser,
} from "@/services/storage";
import RolePill from "@/components/shared/RolePill";

type Rol = "estudiante" | "profesor" | "tecnico" | "admin";

type User = {
  id?: string;
  nombre?: string;
  correo?: string;
  rol?: Rol;
  codigo?: string;
  carrera?: string;
  telefono?: string;
  activo?: boolean;
  created_at?: string;
};

const ROLES: Rol[] = ["estudiante", "profesor", "tecnico", "admin"];
const dominioPorRol: Record<Rol, RegExp> = {
  estudiante: /^[^@\s]+@estudiantec\.cr$/i,
  profesor: /^[^@\s]+@itcr\.ac\.cr$/i,
  tecnico: /^[^@\s]+@itcr\.ac\.cr$/i,
  admin: /^[^@\s]+@tec\.ac\.cr$/i,
};

function validaCorreoRol(correo: string, rol: Rol) {
  return dominioPorRol[rol].test((correo || "").trim());
}

export default function Perfil() {
  const nav = useNavigate();

  const [data, setData] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // edición
  const [edit, setEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<{
    nombre: string;
    correo: string;
    rol: Rol;
    codigo: string;
    carrera: string;
    telefono: string;
  }>({
    nombre: "",
    correo: "",
    rol: "estudiante",
    codigo: "",
    carrera: "",
    telefono: "",
  });

  useEffect(() => {
    if (!getToken()) {
      nav("/auth/login");
      return;
    }
    (async () => {
      try {
        setLoading(true);
        setErr(null);

        const stored = (getStoredUser() as User) || {};
        let apiUser: User = {};
        try {
          apiUser = (await me()) as User;
        } catch {
          // si /me falla, seguimos con lo que haya en local
        }

        const merged: User = { ...stored, ...apiUser };

        setData(merged);
        setForm({
          nombre: merged.nombre || "",
          correo: merged.correo || "",
          rol: (merged.rol as Rol) || "estudiante",
          codigo: merged.codigo || "",
          carrera: merged.carrera || "",
          telefono: merged.telefono || "",
        });
      } catch (e: any) {
        setErr(e?.message ?? "Error cargando perfil");
      } finally {
        setLoading(false);
      }
    })();
  }, [nav]);

  const on = (k: keyof typeof form) => (e: any) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSave = async () => {
    try {
      setSaving(true);
      setErr(null);

      // Validaciones rápidas en cliente
      if (!form.nombre.trim()) {
        setErr("El nombre es obligatorio.");
        setSaving(false);
        return;
      }
      if (!form.correo.trim()) {
        setErr("El correo es obligatorio.");
        setSaving(false);
        return;
      }
      if (!validaCorreoRol(form.correo, form.rol)) {
        setErr(
          `El correo debe pertenecer al dominio institucional para el rol '${form.rol}'.`
        );
        setSaving(false);
        return;
      }
      if (form.telefono && (!/^[0-9]+$/.test(form.telefono) || form.telefono.length !== 8)) {
        setErr("El teléfono debe tener exactamente 8 dígitos (ej: 88881234).");
        setSaving(false);
        return;
      }
      if (form.rol === "estudiante" && form.codigo && String(form.codigo).length !== 10) {
        setErr("Para estudiantes, el código debe tener 10 dígitos.");
        setSaving(false);
        return;
      }

      const payload = {
        nombre: form.nombre,
        correo: form.correo,
        rol: form.rol,
        codigo: form.codigo,
        carrera: form.carrera,
        telefono: form.telefono,
      };

      const updated = await updateMe(payload); // backend devuelve { user, token? }
      setData(updated);
      setStoredUser(updated);
      setEdit(false);
    } catch (e: any) {
      setErr(e?.message ?? "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (data) {
      setForm({
        nombre: data.nombre || "",
        correo: data.correo || "",
        rol: (data.rol as Rol) || "estudiante",
        codigo: data.codigo || "",
        carrera: data.carrera || "",
        telefono: data.telefono || "",
      });
    }
    setEdit(false);
    setErr(null);
  };

  if (loading)
    return <div className="rounded-xl shadow-md bg-white p-6">Cargando…</div>;
  if (err && !edit)
    return (
      <div className="rounded-xl shadow-md bg-white p-6 text-red-500">
        {err}
      </div>
    );
  if (!data)
    return (
      <div className="rounded-xl shadow-md bg-white p-6">
        Sin datos de perfil.
      </div>
    );

  return (
    <div className="rounded-xl shadow-md bg-white dark:bg-darkgray p-6">
      <div className="flex items-center gap-2 mb-6">
        <h5 className="card-title !mb-0">Perfil</h5>
        <RolePill role={edit ? form.rol : (data.rol as Rol)} />
      </div>

      <div className="grid grid-cols-12 gap-30">
        {/* Columna izquierda */}
        <div className="lg:col-span-6 col-span-12">
          <div className="flex flex-col gap-4">
            <div>
              <Label htmlFor="nombre" value="Nombre" />
              <TextInput
                id="nombre"
                value={edit ? form.nombre : data.nombre || ""}
                onChange={on("nombre")}
                readOnly={!edit}
              />
            </div>

            <div>
              <Label htmlFor="correo" value="Correo institucional" />
              <TextInput
                id="correo"
                type="email"
                value={edit ? form.correo : data.correo || ""}
                onChange={on("correo")}
                readOnly={!edit}
              />
            </div>

            <div>
              <Label htmlFor="rol" value="Rol" />
              {!edit ? (
                <TextInput id="rol" value={data.rol || ""} readOnly />
              ) : (
                <Select id="rol" value={form.rol} onChange={on("rol")}>
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </Select>
              )}
            </div>
          </div>
        </div>

        {/* Columna derecha */}
        <div className="lg:col-span-6 col-span-12">
          <div className="flex flex-col gap-4">
            <div>
              <Label htmlFor="codigo" value="Código" />
              <TextInput
                id="codigo"
                value={edit ? form.codigo : data.codigo || ""}
                onChange={on("codigo")}
                readOnly={!edit}
                placeholder={form.rol === "estudiante" ? "10 dígitos" : ""}
              />
            </div>

            <div>
              <Label htmlFor="carrera" value="Carrera / Unidad" />
              <TextInput
                id="carrera"
                value={edit ? form.carrera : data.carrera || ""}
                onChange={on("carrera")}
                readOnly={!edit}
              />
            </div>

            <div>
              <Label htmlFor="telefono" value="Teléfono" />
              <TextInput
                id="telefono"
                value={edit ? form.telefono : data.telefono || ""}
                onChange={on("telefono")}
                readOnly={!edit}
                placeholder="88881234"
              />
            </div>
          </div>
        </div>

        {/* Acciones */}
        <div className="col-span-12 flex gap-3 mt-6">
          {!edit ? (
            <>
              <Button
                className="bg-primary text-white"
                onClick={() => setEdit(true)}
              >
                Editar
              </Button>
              <Button color="light" onClick={() => nav(-1)}>
                Volver
              </Button>
              {err && <p className="text-red-500 text-sm ml-3">{err}</p>}
            </>
          ) : (
            <>
              <Button
                className="bg-primary text-white"
                onClick={handleSave}
                isProcessing={saving}
                disabled={saving}
              >
                Guardar cambios
              </Button>
              <Button color="light" onClick={handleCancel} disabled={saving}>
                Cancelar
              </Button>
              {err && <p className="text-red-500 text-sm ml-3">{err}</p>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
