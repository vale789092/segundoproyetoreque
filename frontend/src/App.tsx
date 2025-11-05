// src/App.tsx
import { Outlet } from "react-router-dom";

export default function App() {
  return (
    <div style={{ minHeight: "100vh" }}>
      {/* aquí podrías poner Navbar, toasts, etc. */}
      <Outlet /> {/* las páginas se renderizan aquí */}
    </div>
  );
}
