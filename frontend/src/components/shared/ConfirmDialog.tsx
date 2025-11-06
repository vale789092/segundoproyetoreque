import { Button, Modal } from "flowbite-react";

export default function ConfirmDialog({
  open, onClose, title="Confirmar", message="¿Seguro?", onConfirm, confirming
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
  onConfirm: () => Promise<void> | void;
  confirming?: boolean;
}) {
  return (
    <Modal show={open} onClose={onClose}>
      <Modal.Header>{title}</Modal.Header>
      <Modal.Body><p className="text-sm">{message}</p></Modal.Body>
      <Modal.Footer>
        <Button className="bg-red-600" onClick={onConfirm} isProcessing={!!confirming} disabled={!!confirming}>Eliminar</Button>
        <Button color="light" onClick={onClose} disabled={!!confirming}>Cancelar</Button>
      </Modal.Footer>
    </Modal>
  );
}
