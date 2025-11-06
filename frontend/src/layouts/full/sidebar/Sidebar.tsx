// src/layouts/full/sidebar/Sidebar.tsx
import React from "react";
import { Sidebar as FB_Sidebar } from "flowbite-react";
import { Link, useLocation } from "react-router";
import SimpleBar from "simplebar-react";

import SidebarContent from "./Sidebaritems";
import NavItems from "./NavItems";
import NavCollapse from "./NavCollapse";

// (opcional rol) helpers para leer el usuario almacenado
import { getUser } from "@/services/storage";

function filterByRole<T extends { roles?: string[]; children?: any[] }>(
  data: T[],
  role?: string
): T[] {
  if (!role) return data;
  return data
    .map((sec) => ({
      ...sec,
      children: (sec.children || []).filter(
        (it: any) => !it.roles || it.roles.includes(role)
      ),
    }))
    .filter((sec) => sec.children && sec.children.length > 0);
}

const Sidebar: React.FC = () => {
  const { pathname } = useLocation();
  const role = (getUser()?.rol as string) || undefined; // ← (opcional rol)
  const sections = filterByRole(SidebarContent, role);   // ← (opcional rol)

  return (
    <div className="xl:block hidden">
      <FB_Sidebar
        className="fixed menu-sidebar bg-white dark:bg-darkgray rtl:pe-4 rtl:ps-0 top-[72px]"
        aria-label="Sidebar"
      >
        {/* Título grande */}
        <div className="px-6 py-4 flex items-center sidebarlogo">
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-dark dark:text-white">
            LabTec
          </h1>
        </div>

        <SimpleBar className="h-[calc(100vh_-_294px)]">
          <FB_Sidebar.Items className="px-5 mt-2">
            {/* Botón Home destacado */}
            <FB_Sidebar.ItemGroup className="mb-3">
              <FB_Sidebar.Item
                as={Link}
                to="/"
                className={`text-[16px] font-semibold rounded-full ${
                  pathname === "/"
                    ? "bg-lightprimary text-primary"
                    : "bg-lightprimary/70 text-primary hover:bg-lightprimary"
                }`}
              >
                Home
              </FB_Sidebar.Item>
            </FB_Sidebar.ItemGroup>

            {/* Secciones dinámicas */}
            <FB_Sidebar.ItemGroup className="sidebar-nav hide-menu">
              {sections.map((section, sIdx) => (
                <div className="caption" key={`${section.heading}-${sIdx}`}>
                  <h5 className="text-link dark:text-white/70 font-semibold leading-6 text-sm pb-2">
                    {section.heading}
                  </h5>

                  {section.children?.map((child, i) => (
                    <React.Fragment key={child.id || i}>
                      {child.children ? (
                        <div className="collpase-items">
                          <NavCollapse item={child} />
                        </div>
                      ) : (
                        <NavItems item={child} />
                      )}
                    </React.Fragment>
                  ))}
                </div>
              ))}
            </FB_Sidebar.ItemGroup>
          </FB_Sidebar.Items>
        </SimpleBar>
      </FB_Sidebar>
    </div>
  );
};

export default Sidebar;
