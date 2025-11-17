import { useState } from "react";
import { Card, Button, Label, TextInput, Select, Table } from "flowbite-react";

export default function Bitacora() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [tipo, setTipo] = useState<"all"|"reserva"|"prestamo"|"devolucion"|"capacitacion"|"otro">("all");

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-semibold">Bitácora</h2>

      <Card>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <Label htmlFor="from" value="Desde" />
            <TextInput id="from" type="date" value={from} onChange={(e)=>setFrom(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="to" value="Hasta" />
            <TextInput id="to" type="date" value={to} onChange={(e)=>setTo(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="tipo" value="Tipo" />
            <Select id="tipo" value={tipo} onChange={(e)=>setTipo(e.target.value as any)}>
              <option value="all">Todos</option>
              <option value="reserva">Reserva</option>
              <option value="prestamo">Préstamo</option>
              <option value="devolucion">Devolución</option>
              <option value="capacitacion">Capacitación</option>
              <option value="otro">Otro</option>
            </Select>
          </div>

          <Button disabled title="Conectar a GET /history (tu endpoint de bitácora)">
            Buscar
          </Button>
          <Button disabled title="Conectar a /history.xlsx">Exportar XLSX</Button>
          <Button color="light" disabled title="Conectar a /history.pdf">Exportar PDF</Button>
        </div>
      </Card>

      <Card>
        <Table>
          <Table.Head>
            <Table.HeadCell>Fecha/Hora</Table.HeadCell>
            <Table.HeadCell>Laboratorio</Table.HeadCell>
            <Table.HeadCell>Acción</Table.HeadCell>
            <Table.HeadCell>Detalle</Table.HeadCell>
            <Table.HeadCell>Usuario</Table.HeadCell>
          </Table.Head>
          <Table.Body className="divide-y">
            {/* Llenar con el GET de bitácora cuando esté listo */}
          </Table.Body>
        </Table>
      </Card>
    </div>
  );
}
