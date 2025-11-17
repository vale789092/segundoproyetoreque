// frontend/src/views/operacion/Devoluciones.tsx
import { useEffect, useState } from "react";
import { Button, Label, Table, TextInput } from "flowbite-react";
import {
  listDevoluciones,
  type PrestamoRow,
} from "@/services/prestamos";

function formatDate(d?: string | null) {
  if (!d) return "-";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return d;
  return dt.toLocaleString("es-CR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

const getLabName = (p: PrestamoRow) => p.laboratorio_nombre || "-";
const getRecursoName = (p: PrestamoRow) => p.recurso_nombre || "-";
const getUsuarioName = (p: PrestamoRow) => p.usuario_nombre || "-";

export default function Devoluciones() {
  const [rows, setRows] = useState<PrestamoRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      setErr(null);
      const data = await listDevoluciones({
        q: search.trim() || undefined,
      });
      setRows(data);
    } catch (e: any) {
      setErr(e?.message ?? "Error cargando devoluciones.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void load();
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-semibold mb-1">Devoluciones</h2>
          <p className="text-sm text-bodytext">
            Historial de devoluciones registradas en los laboratorios.
          </p>
        </div>
      </div>

      <form
        onSubmit={handleSearchSubmit}
        className="flex flex-wrap gap-3 items-end mb-4"
      >
        <div className="w-full sm:w-72">
          <Label htmlFor="searchDevoluciones" value="Buscar" />
          <TextInput
            id="searchDevoluciones"
            placeholder="Usuario, recurso, laboratorio…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <Button
          type="submit"
          className="mt-1 sm:mt-5 bg-primary text-white"
          isProcessing={loading}
        >
          Buscar
        </Button>

        {err && <p className="text-red-500 text-sm ml-2">{err}</p>}
      </form>

      {loading && rows.length === 0 ? (
        <p>Cargando devoluciones…</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <Table.Head>
              <Table.HeadCell>Laboratorio</Table.HeadCell>
              <Table.HeadCell>Recurso</Table.HeadCell>
              <Table.HeadCell>Usuario</Table.HeadCell>
              <Table.HeadCell>Periodo de uso</Table.HeadCell>
              <Table.HeadCell>Fecha de devolución</Table.HeadCell>
            </Table.Head>
            <Table.Body className="divide-y">
              {rows.map((p) => (
                <Table.Row key={p.solicitud_id}>
                  <Table.Cell>{getLabName(p)}</Table.Cell>
                  <Table.Cell>{getRecursoName(p)}</Table.Cell>
                  <Table.Cell>
                    <div className="flex flex-col">
                      <span>{getUsuarioName(p)}</span>
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
                </Table.Row>
              ))}
              {rows.length === 0 && !loading && (
                <Table.Row>
                  <Table.Cell colSpan={5} className="text-center text-sm">
                    No hay devoluciones con los filtros actuales.
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
