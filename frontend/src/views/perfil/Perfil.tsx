import { useEffect, useState } from "react";
import { Button, Label, Select, TextInput, Table } from "flowbite-react";
import { useNavigate } from "react-router";
import { me, updateMe, listUsers, adminUpdateUser } from "@/services";
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

// dominio "plano" para reconstruir el correo al cambiar rol
const dominioTextoPorRol: Record<Rol, string> = {
  estudiante: "estudiantec.cr",
  profesor: "itcr.ac.cr",
  tecnico: "itcr.ac.cr",
  admin: "tec.ac.cr",
};

function validaCorreoRol(correo: string, rol: Rol) {
  return dominioPorRol[rol].test((correo || "").trim());
}

// helper para cambiar el dominio de un correo según el rol
function correoConDominioDeRol(correoActual: string, rol: Rol): string {
  const actual = (correoActual || "").trim();
  if (!actual) return "";

  const atIndex = actual.indexOf("@");
  const local = atIndex === -1 ? actual : actual.slice(0, atIndex); // todo lo antes del @
  const dominioNuevo = dominioTextoPorRol[rol];
  if (!local) return "";

  return `${local}@${dominioNuevo}`;
}

export default function Perfil() {
  const nav = useNavigate();

  const [usersOk, setUsersOk] = useState<string | null>(null);
  const [data, setData] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // edición propio perfil
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

  // ====== ADMIN: gestión de usuarios ======
  const [users, setUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersErr, setUsersErr] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState("");
  const [savingUserId, setSavingUserId] = useState<string | null>(null);

  const actionBtnClass =
    "border border-gray-300 bg-white text-gray-900 hover:bg-gray-50 focus:ring-2 focus:ring-cyan-500";

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

  // Cargar usuarios solo si el perfil es admin
  useEffect(() => {
    if (!data || data.rol !== "admin") return;

    (async () => {
      try {
        setUsersLoading(true);
        setUsersErr(null);
        // trae TODOS los usuarios (el backend excluye al propio admin)
        const all = (await listUsers()) as User[];
        setUsers(
          (all || []).map((u) => ({
            ...u,
            rol: (u.rol as Rol) || "estudiante",
          }))
        );
      } catch (e: any) {
        setUsersErr(e?.message ?? "Error cargando usuarios.");
      } finally {
        setUsersLoading(false);
      }
    })();
  }, [data?.rol]);

  // onChange para el propio formulario de perfil (NO toca el rol)
  const on = (k: keyof typeof form) => (e: any): void => {
    const value = e.target.value;
    setForm((f) => ({ ...f, [k]: value }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setErr(null);

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
      if (
        form.telefono &&
        (!/^[0-9]+$/.test(form.telefono) || form.telefono.length !== 8)
      ) {
        setErr("El teléfono debe tener exactamente 8 dígitos (ej: 88881234).");
        setSaving(false);
        return;
      }
      if (
        form.rol === "estudiante" &&
        form.codigo &&
        String(form.codigo).length !== 10
      ) {
        setErr("Para estudiantes, el código debe tener 10 dígitos.");
        setSaving(false);
        return;
      }

      const payload = {
        nombre: form.nombre,
        correo: form.correo,
        // rol NO se edita desde aquí, pero lo mandamos por si backend lo necesita igual
        rol: form.rol,
        codigo: form.codigo,
        carrera: form.carrera,
        telefono: form.telefono,
      };

      const updated = (await updateMe(payload)) as User;
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

  // ====== ADMIN: helpers ======
  const handleChangeUserField =
    (id: string, field: keyof User) => (e: any) => {
      const value = e.target.value;
      setUsers((prev) =>
        prev.map((u) => {
          if (u.id !== id) return u;

          // si se cambia el rol, actualizamos también el correo con el nuevo dominio
          if (field === "rol") {
            const nuevoRol = value as Rol;
            const nuevoCorreo = correoConDominioDeRol(u.correo || "", nuevoRol);
            return {
              ...u,
              rol: nuevoRol,
              correo: nuevoCorreo,
            };
          }

          return { ...u, [field]: value };
        })
      );
    };

  const handleSaveUser = async (user: User) => {
    if (!user.id) return;
    try {
      setSavingUserId(user.id);
      setUsersErr(null);

      const nombre = (user.nombre || "").trim();
      const correo = (user.correo || "").trim();
      const rol = (user.rol as Rol) || "estudiante";
      const telefono = user.telefono || "";
      const codigo = user.codigo || "";

      if (!nombre) {
        setUsersErr("El nombre es obligatorio.");
        return;
      }
      if (!correo) {
        setUsersErr("El correo es obligatorio.");
        return;
      }
      if (!validaCorreoRol(correo, rol)) {
        setUsersErr(
          `El correo de ${nombre} no coincide con el dominio permitido para el rol '${rol}'.`
        );
        return;
      }
      if (
        telefono &&
        (!/^[0-9]+$/.test(telefono) || telefono.length !== 8)
      ) {
        setUsersErr(
          `El teléfono de ${nombre} debe tener exactamente 8 dígitos (ej: 88881234).`
        );
        return;
      }
      if (rol === "estudiante" && codigo && String(codigo).length !== 10) {
        setUsersErr(
          `El código de ${nombre} debe tener 10 dígitos si el rol es estudiante.`
        );
        return;
      }

      const payload = {
        nombre,
        correo,
        rol,
        codigo,
        carrera: user.carrera || "",
        telefono,
        activo: user.activo,
      };

      const updated = (await adminUpdateUser(user.id, payload)) as User;

      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, ...updated } : u))
      );

      setUsersOk(`Cambios guardados para ${updated.nombre || "el usuario"}.`);
      setUsersErr(null);

    } catch (e: any) {
      setUsersErr(e?.message ?? "No se pudo actualizar el usuario.");
    } finally {
      setSavingUserId(null);
    }
  };

  const filteredUsers = users.filter((u) => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return true;
    const nombre = (u.nombre || "").toLowerCase();
    const correo = (u.correo || "").toLowerCase();
    return nombre.includes(q) || correo.includes(q);
  });

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
              {/* El rol del propio usuario NO es editable */}
              <TextInput id="rol" value={data.rol || ""} readOnly />
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

      {/* ====== Panel admin para cambiar rol/correo de otros usuarios ====== */}
      {data.rol === "admin" && (
        <div className="mt-10 border-t pt-6">
          <h6 className="font-semibold mb-2">Administrar usuarios</h6>
          <p className="text-sm text-gray-500 mb-4">
            Como administrador podés actualizar el rol y el correo institucional
            de otros usuarios. El dominio del correo se ajusta automáticamente
            según el rol seleccionado.
          </p>

          <div className="flex flex-wrap items-end gap-3 mb-4">
            <div className="w-full sm:w-72">
              <Label
                htmlFor="buscarUsuario"
                value="Buscar por nombre o correo"
              />
              <TextInput
                id="buscarUsuario"
                placeholder="Ej: María, juan@estudiantec.cr"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
              />
            </div>
            {usersOk && (
              <p className="text-green-600 text-sm mb-4">
                {usersOk}
              </p>
            )}

            {usersErr && (
              <p className="text-red-500 text-sm">{usersErr}</p>
            )}
          </div>


          {usersLoading ? (
            <p>Cargando usuarios…</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <Table.Head>
                  <Table.HeadCell>Nombre</Table.HeadCell>
                  <Table.HeadCell>Correo</Table.HeadCell>
                  <Table.HeadCell>Rol</Table.HeadCell>
                  <Table.HeadCell>Código</Table.HeadCell>
                  <Table.HeadCell>Carrera / Unidad</Table.HeadCell>
                  <Table.HeadCell>Teléfono</Table.HeadCell>
                  <Table.HeadCell>Acciones</Table.HeadCell>
                </Table.Head>
                <Table.Body className="divide-y">
                  {filteredUsers.map((u) => (
                    <Table.Row key={u.id}>
                      <Table.Cell className="min-w-[160px]">
                        <TextInput
                          value={u.nombre || ""}
                          onChange={handleChangeUserField(
                            u.id as string,
                            "nombre"
                          )}
                        />
                      </Table.Cell>
                      <Table.Cell className="min-w-[200px]">
                        <TextInput
                          type="email"
                          value={u.correo || ""}
                          onChange={handleChangeUserField(
                            u.id as string,
                            "correo"
                          )}
                        />
                      </Table.Cell>
                      <Table.Cell className="min-w-[140px]">
                        <Select
                          value={(u.rol as Rol) || "estudiante"}
                          onChange={handleChangeUserField(
                            u.id as string,
                            "rol"
                          )}
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </Select>
                      </Table.Cell>
                      <Table.Cell className="min-w-[120px]">
                        <TextInput
                          value={u.codigo || ""}
                          onChange={handleChangeUserField(
                            u.id as string,
                            "codigo"
                          )}
                          placeholder={
                            (u.rol as Rol) === "estudiante"
                              ? "10 dígitos"
                              : ""
                          }
                        />
                      </Table.Cell>
                      <Table.Cell className="min-w-[160px]">
                        <TextInput
                          value={u.carrera || ""}
                          onChange={handleChangeUserField(
                            u.id as string,
                            "carrera"
                          )}
                        />
                      </Table.Cell>
                      <Table.Cell className="min-w-[120px]">
                        <TextInput
                          value={u.telefono || ""}
                          onChange={handleChangeUserField(
                            u.id as string,
                            "telefono"
                          )}
                          placeholder="88881234"
                        />
                      </Table.Cell>
                      <Table.Cell className="min-w-[120px]">
                        <Button
                          size="xs"
                          className={actionBtnClass}
                          onClick={() => handleSaveUser(u)}
                          isProcessing={savingUserId === u.id}
                          disabled={savingUserId === u.id}
                        >
                          Guardar
                        </Button>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                  {filteredUsers.length === 0 && (
                    <Table.Row>
                      <Table.Cell colSpan={7} className="text-center text-sm">
                        No hay usuarios que coincidan con el filtro.
                      </Table.Cell>
                    </Table.Row>
                  )}
                </Table.Body>
              </Table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
