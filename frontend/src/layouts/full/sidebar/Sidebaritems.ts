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
  roles?: Rol[];
};

export type SidebarSection = {
  heading: string;
  children: NavItem[];
  roles?: Rol[];
};

export type ChildItem = NavItem;

const SidebarContent: SidebarSection[] = [
  {
    heading: "Operación",
    children: [
      { id: "reservas",  title: "Reservas",  to: "/app/reservas",  roles: ["estudiante","profesor","tecnico"] },
      { id: "mis-solicitudes", title: "Mis solicitudes", to: "/app/mis-solicitudes", roles: ["estudiante","profesor"] },
      { id: "mi-historial",    title: "Mi historial",    to: "/app/historial", roles: ["estudiante","profesor"] },
      { id: "solicitudes-admin", title: "Aprobación/Solicitudes", to: "/app/operacion/solicitudes-admin", roles: ["tecnico","admin"] },
      { id: "prestamos",     title: "Préstamos",    to: "/app/prestamos",    roles: ["profesor","tecnico","admin"] },
      { id: "devoluciones",  title: "Devoluciones", to: "/app/devoluciones", roles: ["profesor","tecnico","admin"] },
      //{ id: "bitacora", title: "Bitácora", to: "/app/bitacora", roles: ["profesor","tecnico","admin"] },
      { id: "mantenimientos", title: "Mantenimientos", to: "/app/mantenimientos", roles: ["tecnico","admin"]},
    ],
  },

  // Sección propia para Reportes 
    {
    heading: "Reportes",
    children: [
      //{ id: "rep-home",       title: "Resumen",    to: "/app/reportes",                 roles: ["tecnico","admin"] },
      { id: "rep-global",     title: "Uso global", to: "/app/reportes/uso-global",      roles: ["tecnico","admin"] },
      { id: "rep-inventario", title: "Inventario", to: "/app/reportes/inventario",      roles: ["tecnico","admin"] },
      { id: "rep-mant",       title: "Mantenimiento", to: "/app/reportes/mantenimiento", roles: ["tecnico","admin"] },
    ],
  }
];

export default SidebarContent;
