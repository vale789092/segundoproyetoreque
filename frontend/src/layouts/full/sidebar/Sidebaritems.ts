import type { ReactNode } from "react";
export type Rol = "estudiante" | "profesor" | "tecnico" | "admin";

export type NavItem = {
  id: string;
  title: string;
  to?: string;
  external?: string;
  icon?: ReactNode;
  badge?: string;
  children?: NavItem[];
  roles?: Rol[];          // ← NUEVO
};

export type SidebarSection = {
  heading: string;
  children: NavItem[];
  roles?: Rol[];          // (opcional) por sección completa
};

const SidebarContent: SidebarSection[] = [
  {
    heading: "Operación",
    children: [
      { id: "reservas",     title: "Reservas",     to: "/app/reservas",     roles: ["estudiante","profesor","tecnico","admin"] },
      { id: "prestamos",    title: "Préstamos",    to: "/app/prestamos",    roles: ["profesor","tecnico","admin"] },
      { id: "devoluciones", title: "Devoluciones", to: "/app/devoluciones", roles: ["profesor","tecnico","admin"] },
      { id: "inventario",   title: "Inventario",   to: "/app/inventario",   roles: ["tecnico","admin"] },
      { id: "reportes",     title: "Reportes",     to: "/app/reportes",     roles: ["profesor","tecnico","admin"] },
    ],
  },
  {
    heading: "Utilities",
    children: [
      { id: "typography", title: "Typography", to: "/app/ui/typography", roles: ["admin","tecnico","profesor","estudiante"] },
      { id: "table",      title: "Table",      to: "/app/ui/table",      roles: ["admin","tecnico","profesor","estudiante"] },
      { id: "form",       title: "Form",       to: "/app/ui/form",       roles: ["admin","tecnico","profesor","estudiante"] },
      { id: "alerts",     title: "Alert",      to: "/app/ui/alert",      roles: ["admin","tecnico","profesor","estudiante"] },
    ],
  },
  {
    heading: "Apps",
    children: [
      { id: "users",    title: "Users",    to: "/app/users",    roles: ["admin"] },
      { id: "settings", title: "Settings", to: "/app/settings", roles: ["admin","tecnico"] },
    ],
  },
];

export default SidebarContent;
