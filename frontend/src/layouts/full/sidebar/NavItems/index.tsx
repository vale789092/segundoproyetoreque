import React from "react";
import { Sidebar } from "flowbite-react";
import { Icon } from "@iconify/react";
import { Link, useLocation } from "react-router";
import type { NavItem as Item } from "../Sidebaritems"; // usa tu tipo

interface NavItemsProps {
  item: Item;
}

const NavItems: React.FC<NavItemsProps> = ({ item }) => {
  const { pathname } = useLocation();

  // Soporte to / external
  const isExternal = Boolean(item.external);
  const href = item.external ?? item.to ?? "#";

  const isActive = item.to ? pathname === item.to : false;

  // Componente a usar según sea interno o externo
  const asComp: any = isExternal ? "a" : Link;
  const linkProps = isExternal
    ? { href, target: "_blank", rel: "noreferrer" }
    : { to: href };

  return (
    <Sidebar.Item
      as={asComp}
      {...linkProps}
      className={`text-[15px] ${
        isActive
          ? "text-primary bg-lightprimary rounded-full hover:text-primary hover:bg-lightprimary dark:hover:text-primary active"
          : "text-dark dark:text-white bg-transparent group/link hover:bg-lightprimary hover:text-primary"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="flex gap-3 items-center">
          {item.icon ? (
            // si pasas icon como <Icon .../>
            typeof item.icon === "string" ? (
              <Icon icon={item.icon} className={`${(item as any).color ?? ""}`} height={18} />
            ) : (
              item.icon
            )
          ) : (
            <span
              className={`h-[6px] w-[6px] rounded-full mx-1.5 ${
                isActive
                  ? "bg-primary dark:bg-white"
                  : "bg-black/40 dark:bg-white group-hover/link:bg-primary"
              }`}
            />
          )}

          {/* ←— AQUÍ SE MUESTRA EL NOMBRE DEL ITEM */}
          <span className="max-w-24 text-ellipsis overflow-x-hidden">
            {item.title}
          </span>
        </span>

        {item.badge && (
          <span className="py-0 px-2.5 text-[10px] bg-lightsecondary text-secondary rounded-full">
            {item.badge}
          </span>
        )}
      </div>
    </Sidebar.Item>
  );
};

export default NavItems;
