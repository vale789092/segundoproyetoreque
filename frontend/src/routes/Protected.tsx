// src/routes/Protected.tsx
import { Navigate, Outlet } from "react-router";
import { getToken, getUser } from "@/services/storage";

type Props = {
  roles?: Array<"estudiante" | "profesor" | "tecnico" | "admin">;
  children?: React.ReactNode;
};

export default function Protected({ roles, children }: Props) {
  const token = getToken();
  if (!token) return <Navigate to="/auth/login" replace />;

  // (opcional) gate por rol
  if (roles && roles.length > 0) {
    const user = getUser();
    if (!user || !roles.includes(user.rol)) {
      return <Navigate to="/" replace />;
    }
  }

  // Soporta usarse como layout (Outlet) o como wrapper de children
  return <>{children ?? <Outlet />}</>;
}
