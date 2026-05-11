import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import Header from "./Header";
import Sidebar from "./Sidebar";

export default function Layout() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return window.localStorage.getItem("sidebar-collapsed") === "1";
  });

  useEffect(() => {
    window.localStorage.setItem(
      "sidebar-collapsed",
      isSidebarCollapsed ? "1" : "0",
    );
  }, [isSidebarCollapsed]);

  return (
    <div className="h-screen flex flex-col">
      <Header
        isSidebarCollapsed={isSidebarCollapsed}
        onToggleSidebar={() => setIsSidebarCollapsed((prev) => !prev)}
      />
      <div className="flex-1 flex min-h-0 overflow-hidden">
        <Sidebar isCollapsed={isSidebarCollapsed} />
        <main className="flex-1 min-h-0 overflow-y-auto bg-gray-50 p-4 lg:p-5">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
