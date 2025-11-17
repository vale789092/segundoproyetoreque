// src/views/operacion/Prestamos.tsx
import { useEffect, useState } from "react";
import { Button, Label, Select, Table, TextInput } from "flowbite-react";
import {
  listPrestamos,
  registrarDevolucion,
  type PrestamoItem,
  type EstadoPrestamoFiltro,
} from "@/services/prestamos";
import { getUser } from "@/services/storage";

function formatDate(d?: string | null) {
  if (!d) return "-";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return d;
  return dt.toLocaleString("es-CR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export default function Prestamos() {
  const me = getUser() as
    | { rol?: "estudiante" | "profesor" | "tecnico" | "admin" }
    | null;

  const [rows, setRows] = useState<PrestamoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [estado, setEstado] = useState<EstadoPrestamoFiltro>("activos");

  const canRegistrarDevolucion = (p: PrestamoItem) => {
    const rol = me?.rol;
    const isAdminOrTec = rol === "admin" || rol === "tecnico";
    // solo cuando aún no tiene fecha_devolucion (préstamo activo)
    return isAdminOrTec && !p.fecha_devolucion;
  };

  const load = async () => {
    try {
      setLoading(true);
      setErr(null);
      setOk(null);

      const q = search.trim() || undefined;
      // ⬅️ aquí ahora pasamos el objeto { estado, q }
      const data = await listPrestamos({ estado, q });

      // si quieres, puedes dejar este filtro extra en front, pero ya no es obligatorio
      setRows(data);
    } catch (e: any) {
      setErr(e?.message ?? "Error cargando préstamos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void load();
  };

  const handleDevolver = async (p: PrestamoItem) => {
    const confirm = window.confirm(
      `¿Registrar devolución del recurso "${p.recurso_nombre}" para ${p.usuario_nombre}?`
    );
    if (!confirm) return;

    try {
      setLoading(true);
      setErr(null);
      setOk(null);

      // usamos el id de la SOLICITUD
      await registrarDevolucion(p.solicitud_id);

      // recargamos lista
      await load();
      setOk("Devolución registrada correctamente ✅");
    } catch (e: any) {
      setErr(e?.message ?? "No se pudo registrar la devolución.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-semibold mb-1">Préstamos</h2>
          <p className="text-sm text-bodytext">
            Administración centralizada de préstamos activos y recientes.
          </p>
        </div>
      </div>

      <form
        onSubmit={handleSearchSubmit}
        className="flex flex-wrap gap-3 items-end mb-4"
      >
        <div className="w-full sm:w-72">
          <Label htmlFor="searchPrestamos" value="Buscar" />
          <TextInput
            id="searchPrestamos"
            placeholder="Usuario, recurso, laboratorio…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div>
          <Label htmlFor="estadoPrestamos" value="Estado" />
          <Select
            id="estadoPrestamos"
            value={estado}
            onChange={(e) => setEstado(e.target.value as EstadoPrestamoFiltro)}
          >
            <option value="activos">Sólo activos</option>
            <option value="devueltos">Sólo devueltos</option>
            <option value="todos">Todos</option>
          </Select>
        </div>

        <Button
          type="submit"
          className="mt-1 sm:mt-5 bg-primary text-white"
          isProcessing={loading}
        >
          Actualizar
        </Button>

        {ok && <p className="text-green-600 text-sm ml-2">{ok}</p>}
        {err && <p className="text-red-500 text-sm ml-2">{err}</p>}
      </form>

      {loading && rows.length === 0 ? (
        <p>Cargando préstamos…</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <Table.Head>
              <Table.HeadCell>Laboratorio</Table.HeadCell>
              <Table.HeadCell>Recurso</Table.HeadCell>
              <Table.HeadCell>Usuario</Table.HeadCell>
              <Table.HeadCell>Periodo de uso</Table.HeadCell>
              <Table.HeadCell>Fecha devolución</Table.HeadCell>
              <Table.HeadCell>Acciones</Table.HeadCell>
            </Table.Head>
            <Table.Body className="divide-y">
              {rows.map((p) => (
                <Table.Row key={p.solicitud_id}>
                  <Table.Cell>{p.laboratorio_nombre}</Table.Cell>
                  <Table.Cell>{p.recurso_nombre}</Table.Cell>
                  <Table.Cell>
                    <div className="flex flex-col">
                      <span>{p.usuario_nombre}</span>
                      {p.usuario_codigo && (
                        <span className="text-xs text-gray-500">
                          Código: {p.usuario_codigo}
                        </span>
                      )}
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex flex-col text-xs">
                      <span>
                        Inicio:{" "}
                        {formatDate(p.fecha_uso_inicio || p.aprobada_en)}
                      </span>
                      <span>Fin: {formatDate(p.fecha_uso_fin)}</span>
                    </div>
                  </Table.Cell>
                  <Table.Cell>{formatDate(p.fecha_devolucion)}</Table.Cell>
                  <Table.Cell>
                    {canRegistrarDevolucion(p) ? (
                      <Button
                        size="xs"
                        color="success"
                        onClick={() => handleDevolver(p)}
                        disabled={loading}
                      >
                        Registrar devolución
                      </Button>
                    ) : p.fecha_devolucion ? (
                      <span className="text-xs text-green-700">
                        Devuelto
                      </span>
                    ) : (
                      <span className="text-xs text-slate-500">
                        Sin acciones
                      </span>
                    )}
                  </Table.Cell>
                </Table.Row>
              ))}
              {rows.length === 0 && !loading && (
                <Table.Row>
                  <Table.Cell colSpan={6} className="text-center text-sm">
                    No hay préstamos con los filtros actuales.
                  </Table.Cell>
                </Table.Row>
              )}
            </Table.Body>
          </Table>
        </div>
      )}
    </div>
  );
}
