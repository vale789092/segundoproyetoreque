// src/routes/AppRoutes.tsx
import { Routes, Route, Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import App from "@/App";
import Auth from "@/pages/Auth";

function Private({ children }: { children: ReactNode }) {
  return localStorage.getItem("token") ? <>{children}</> : <Navigate to="/login" replace />;
}

function Home() {
  return <div style={{ padding: 24 }}>Dashboard</div>;
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route element={<App />}>
        {/* públicas: misma pantalla, pestaña según URL */}
        <Route path="/login" element={<Auth initialTab="login" />} />
        <Route path="/register" element={<Auth initialTab="register" />} />

        {/* privadas */}
        <Route
          path="/"
          element={
            <Private>
              <Home />
            </Private>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
