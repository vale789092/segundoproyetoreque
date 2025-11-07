// components/labs/LabForm.tsx
import { useEffect, useState } from "react";
import { Button, Modal, TextInput, Label, Textarea } from "flowbite-react";

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: { nombre:string; codigo_interno:string; ubicacion:string; descripcion?:string|null }) => Promise<void> | void;
  initial?: { nombre?:string; codigo_interno?:string; ubicacion?:string; descripcion?:string|null };
  title?: string;
  submitting?: boolean;
};

export default function LabForm({ open, onClose, onSubmit, initial, title="Laboratorio", submitting }: Props) {
  const [form, setForm] = useState({
    nombre: "", codigo_interno: "", ubicacion: "", descripcion: "" as string | undefined
  });
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setErr(null);
    setForm({
      nombre: initial?.nombre ?? "",
      codigo_interno: initial?.codigo_interno ?? "",
      ubicacion: initial?.ubicacion ?? "",
      descripcion: initial?.descripcion ?? "",
    });
  }, [initial, open]);

  const on = (k: keyof typeof form) => (e: any) => setForm({ ...form, [k]: e.target.value });

  const handleSubmit = async () => {
    setErr(null);
    if (!form.nombre.trim() || !form.codigo_interno.trim() || !form.ubicacion.trim()) {
      setErr("Nombre, código interno y ubicación son requeridos.");
      return;
    }
    await onSubmit({
      nombre: form.nombre.trim(),
      codigo_interno: form.codigo_interno.trim(),
      ubicacion: form.ubicacion.trim(),
      descripcion: form.descripcion?.trim() || undefined,
    });
  };

  return (
    <Modal show={open} onClose={onClose}>
      <Modal.Header>{title}</Modal.Header>
      <Modal.Body>
        <div className="space-y-3">
          <div>
            <Label htmlFor="labNombre" value="Nombre" />
            <TextInput id="labNombre" value={form.nombre} onChange={on("nombre")} placeholder="Lab Electrónica I" />
          </div>
          <div>
            <Label htmlFor="labCodigo" value="Código interno" />
            <TextInput id="labCodigo" value={form.codigo_interno} onChange={on("codigo_interno")} placeholder="ELEC-101" />
          </div>
          <div>
            <Label htmlFor="labUbi" value="Ubicación" />
            <TextInput id="labUbi" value={form.ubicacion} onChange={on("ubicacion")} placeholder="Edificio A, piso 1" />
          </div>
          <div>
            <Label htmlFor="labDesc" value="Descripción" />
            <Textarea id="labDesc" rows={3} value={form.descripcion ?? ""} onChange={on("descripcion")} />
          </div>
          {err && <p className="text-sm text-red-600">{err}</p>}
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button className="bg-primary text-white" onClick={handleSubmit} isProcessing={!!submitting} disabled={!!submitting}>
          Guardar
        </Button>
        <Button color="light" onClick={onClose} disabled={!!submitting}>Cancelar</Button>
      </Modal.Footer>
    </Modal>
  );
}
