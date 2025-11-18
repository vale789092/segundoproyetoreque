import { useEffect, useState } from "react";
import { Badge, Dropdown } from "flowbite-react";
import { Icon } from "@iconify/react";
import { Link } from "react-router";
import {
  listNotificaciones,
  type NotificacionRow,
  marcarNotificacionLeida,
  marcarTodasLeidas,
} from "@/services/notificaciones";

const Notification = () => {
  const [items, setItems] = useState<NotificacionRow[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      // 🔹 Solo traemos NO leídas
      const data = await listNotificaciones({ limit: 10, onlyUnread: true });
      setItems(data);
    } catch (e) {
      console.error("Error cargando notificaciones", e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();

    const id = setInterval(() => {
      void load();
    }, 15000);

    return () => clearInterval(id);
  }, []);

  // Como solo mostramos no leídas, es simplemente el length
  const unreadCount = items.length;

  return (
    <div className="relative group/menu">
      <Dropdown
        label=""
        dismissOnClick={false}
        className="rounded-sm w-[260px] notification"
        renderTrigger={() => (
          <span
            className="h-10 w-10 hover:text-primary group-hover/menu:bg-lightprimary group-hover/menu:text-primary hover:bg-lightprimary rounded-full flex justify-center items-center cursor-pointer relative"
            aria-label="Notifications"
          >
            <Icon icon="solar:bell-linear" height={20} />
            {unreadCount > 0 && (
              <Badge className="h-4 min-w-[16px] px-1 rounded-full absolute end-1 top-0 bg-primary text-[10px] text-white flex items-center justify-center p-0">
                {unreadCount}
              </Badge>
            )}
          </span>
        )}
      >
        <div className="px-3 py-2 border-b text-sm font-medium">
          Notificaciones
        </div>

        {loading ? (
          <div className="px-3 py-3 text-xs text-slate-500">
            Cargando notificaciones…
          </div>
        ) : items.length === 0 ? (
          <div className="px-3 py-3 text-xs text-slate-500">
            No tienes notificaciones.
          </div>
        ) : (
          <>
            {items.map((n) => (
              <Dropdown.Item
                as={Link}
                key={n.id}
                to={n.link || "#"}
                className="px-3 py-2 flex flex-col gap-1 text-xs hover:bg-gray-100"
                onClick={async () => {
                  try {
                    await marcarNotificacionLeida(n.id);
                  } catch (e) {
                    console.error("Error marcando notificación como leída", e);
                  } finally {
                    // 🔹 La quitamos de la lista local
                    setItems((prev) => prev.filter((x) => x.id !== n.id));
                  }
                }}
              >
                <span className="font-semibold">{n.titulo}</span>
                <span className="text-slate-600">{n.mensaje}</span>
                <span className="text-[10px] text-slate-400">
                  {new Date(n.creada_en).toLocaleString("es-CR")}
                </span>
              </Dropdown.Item>
            ))}

            <Dropdown.Item
              className="px-3 py-2 text-[11px] text-primary hover:bg-gray-100"
              onClick={async () => {
                try {
                  await marcarTodasLeidas();
                } catch (e) {
                  console.error("Error marcando todas como leídas", e);
                } finally {
                  // 🔹 Limpiamos todo visualmente
                  setItems([]);
                }
              }}
            >
              Marcar todas como leídas
            </Dropdown.Item>
          </>
        )}
      </Dropdown>
    </div>
  );
};

export default Notification;
