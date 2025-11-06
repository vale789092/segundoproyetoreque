// frontend/src/layouts/full/sidebar/Sidebaritems.ts
import type { ReactNode } from "react";

/** Tipo de cada ítem de navegación */
export type NavItem = {
  id: string;
  title: string;
  to?: string;           // ruta interna
  external?: string;     // url externa
  icon?: ReactNode;      // opcional
  badge?: string;        // opcional (ej: "New", "Pro")
  children?: NavItem[];  // submenú (colapsable)
};

export type SidebarSection = {
  heading: string;
  children: NavItem[];
};

const SidebarContent: SidebarSection[] = [
  {
    heading: "Operación",
    children: [
      { id: "reservas",      title: "Reservas",                to: "/app/reservas" },
      { id: "prestamos",     title: "Préstamos",               to: "/app/prestamos" },
      { id: "devoluciones",  title: "Devoluciones",            to: "/app/devoluciones" },
      { id: "inventario",    title: "Inventario",              to: "/app/inventario" },
      { id: "reportes",      title: "Reportes",                to: "/app/reportes" },
      // ←←← Para agregar más, inserta aquí otro objeto:
      // { id: "tu-id", title: "Mi Nueva Sección", to: "/app/mi-ruta" },
    ],
  },

  // (opcional) deja tus utilidades debajo
  {
    heading: "Utilities",
    children: [
      { id: "typography", title: "Typography", to: "/app/ui/typography" },
      { id: "table",      title: "Table",      to: "/app/ui/table" },
      { id: "form",       title: "Form",       to: "/app/ui/form" },
      { id: "alerts",     title: "Alert",      to: "/app/ui/alert" },
    ],
  },

  // (opcional) sección de apps propias
  {
    heading: "Apps",
    children: [
      { id: "users",    title: "Users",    to: "/app/users" },
      { id: "settings", title: "Settings", to: "/app/settings" },
    ],
  },
];

export default SidebarContent;
