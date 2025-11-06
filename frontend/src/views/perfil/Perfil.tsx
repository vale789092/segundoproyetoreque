import { useEffect, useState } from "react";
import { Button, Label, TextInput } from "flowbite-react";
import { useNavigate } from "react-router";
import { me } from "@/services";
import { getToken } from "@/services/storage";
import RolePill from "src/components/shared/RolePill";

type User = {
  id: string;
  nombre: string;
  correo: string;
  rol: "estudiante" | "profesor" | "tecnico" | "admin";
  codigo: string;
  carrera: string;
  telefono: string;
  activo?: boolean;
  created_at?: string;
};

export default function Perfil() {
  const nav = useNavigate();
  const [data, setData] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    // si no hay token, a login
    if (!getToken()) {
      nav("/auth/login");
      return;
    }
    (async () => {
      try {
        setLoading(true);
        setErr(null);
        const meResp = await me(); // { id, nombre, correo, rol, ... }
        setData(meResp);
      } catch (e: any) {
        setErr(e?.message ?? "Error cargando perfil");
      } finally {
        setLoading(false);
      }
    })();
  }, [nav]);

  return (
    <div className="rounded-xl dark:shadow-dark-md shadow-md bg-white dark:bg-darkgray p-6 relative w-full break-words">
      <div className="flex items-center gap-2">
        <h5 className="card-title !mb-0">Perfil</h5>
        <RolePill role={data?.rol} />
      </div>

      <div className="mt-6">
        {loading ? (
          <p className="text-sm text-bodytext">Cargando…</p>
        ) : err ? (
          <p className="text-sm text-red-500">{err}</p>
        ) : data ? (
          <div className="grid grid-cols-12 gap-30">
            <div className="lg:col-span-6 col-span-12">
              <div className="flex flex-col gap-4">
                <div>
                  <div className="mb-2 block">
                    <Label htmlFor="nombre" value="Nombre" />
                  </div>
                  <TextInput id="nombre" value={data.nombre} readOnly className="form-control" />
                </div>

                <div>
                  <div className="mb-2 block">
                    <Label htmlFor="correo" value="Correo institucional" />
                  </div>
                  <TextInput id="correo" value={data.correo} readOnly className="form-control" />
                </div>

                <div>
                  <div className="mb-2 block">
                    <Label htmlFor="rol" value="Rol" />
                  </div>
                  <TextInput id="rol" value={data.rol} readOnly className="form-control" />
                </div>
              </div>
            </div>

            <div className="lg:col-span-6 col-span-12">
              <div className="flex flex-col gap-4">
                <div>
                  <div className="mb-2 block">
                    <Label htmlFor="codigo" value="Código" />
                  </div>
                  <TextInput id="codigo" value={data.codigo} readOnly className="form-control" />
                </div>

                <div>
                  <div className="mb-2 block">
                    <Label htmlFor="carrera" value="Carrera / Unidad" />
                  </div>
                  <TextInput id="carrera" value={data.carrera} readOnly className="form-control" />
                </div>

                <div>
                  <div className="mb-2 block">
                    <Label htmlFor="telefono" value="Teléfono" />
                  </div>
                  <TextInput id="telefono" value={data.telefono} readOnly className="form-control" />
                </div>
              </div>
            </div>

            {/* Footer con acciones futuras */}
            <div className="col-span-12 flex gap-3">
              <Button color="primary" disabled>
                Editar (próximamente)
              </Button>
              <Button color="light" onClick={() => nav(-1)}>
                Volver
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-bodytext">Sin datos de perfil.</p>
        )}
      </div>
    </div>
  );
}
