// src/components/chats/ChatDock.tsx
import { useEffect, useMemo, useState } from "react";
import { Button, Select, TextInput } from "flowbite-react";
import { Icon } from "@iconify/react";
import { getUser } from "@/services/storage";

// Usa los nombres reales del servicio
import { chatSearchPeers, type ChatPeer } from "@/services/chat";

export default function ChatDock() {
  const me = getUser() as { id?: string; nombre?: string; correo?: string } | null;


  const [open, setOpen] = useState(true);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<ChatPeer[]>([]);
  const [targetId, setTargetId] = useState<string>("");

  // buscar cuando cambia query
  useEffect(() => {
    let alive = true;
    (async () => {
      const list = await chatSearchPeers(query); // ya excluye al usuario actual
      if (!alive) return;

      setOptions(list);

      // si el seleccionado ya no está en opciones, resetea
      if (targetId && !list.find((u) => u.id === targetId)) {
        setTargetId("");
      }
    })();
    return () => {
      alive = false;
    };
  }, [query, me?.id]); // me?.id solo para re-evaluar si cambias de sesión

  const target = useMemo(
    () => options.find((u) => u.id === targetId) || null,
    [options, targetId]
  );

  return (
    <div className="fixed bottom-6 right-6 z-50 w-[360px]">
      {/* Header */}
      <div className="rounded-t-xl bg-white dark:bg-darkgray shadow-md px-4 py-3 flex items-center justify-between">
        <span className="font-semibold">Chat</span>
        <button onClick={() => setOpen((v) => !v)}>
          <Icon icon={open ? "solar:minus-circle-linear" : "solar:chat-round-dots-linear"} />
        </button>
      </div>

      {open && (
        <div className="rounded-b-xl bg-white dark:bg-darkgray shadow-md p-4 space-y-3">
          <div>
            <label className="text-sm font-medium">Conversar con</label>
            <div className="mt-2 flex items-center gap-2">
              <span className="h-10 w-10 flex items-center justify-center rounded-full bg-lightgray">
                <Icon icon="solar:magnifier-linear" />
              </span>
              <TextInput
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por nombre o correo…"
                className="flex-1"
              />
            </div>

            <Select
              className="mt-2 w-full"
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
            >
              <option value="" disabled>
                {options.length ? "Selecciona un usuario…" : "No hay coincidencias"}
              </option>
              {options.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombre} — {u.correo}
                </option>
              ))}
            </Select>
          </div>

          {/* Caja de mensajes (mock visual) */}
          <div className="h-48 rounded-lg bg-lightgray/40 p-3 overflow-auto">
            {!target ? (
              <p className="text-sm text-bodytext/70">
                Elige un usuario para comenzar la conversación.
              </p>
            ) : (
              <p className="text-sm text-bodytext/70">
                Conversación con <b>{target.nombre}</b> ({target.correo})
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <TextInput className="flex-1" placeholder="Escribe un mensaje..." disabled={!target} />
            <Button className="bg-primary text-white" disabled={!target}>
              Enviar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
