import { FC } from "react";
import { Outlet } from "react-router";
import ScrollToTop from "src/components/shared/ScrollToTop";
import Sidebar from "./sidebar/Sidebar";
import Header from "./header/Header";
import Topbar from "./header/Topbar";
//import ChatDock from "@/components/chats/ChatDock";

const FullLayout: FC = () => {
  return (
    <>
      <Topbar />
      <div className="flex w-full bg-lightgray min-h-[calc(100vh_-_65px)]">
        <div className="page-wrapper flex w-full">
          {/* Sidebar */}
          <Sidebar />

          <div className="page-wrapper-sub flex flex-col w-full">
            {/* Header */}
            <Header />

            {/* Body */}
            <div className="h-100 w-full">
              <ScrollToTop>
                <div className="container py-30">
                  <Outlet />
                </div>
              </ScrollToTop>
            </div>

            {/* Footer (si quieres algo aquí) */}
            <div className="bg-lightgray text-center mt-auto" />
          </div>
        </div>
      </div>
      {/* <ChatDock /> Chat flotante visible en todo FullLayout */}
      
    </>
  );
};

export default FullLayout;
