// src/routes/Router.tsx
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { lazy } from 'react';
import { Navigate, createBrowserRouter } from "react-router";
import Loadable from 'src/layouts/full/shared/loadable/Loadable';

const FullLayout  = Loadable(lazy(() => import('../layouts/full/FullLayout')));
const BlankLayout = Loadable(lazy(() => import('../layouts/blank/BlankLayout')));
const Protected   = Loadable(lazy(() => import('./Protected')));

// Dashboard
const Dashboard   = Loadable(lazy(() => import('../views/dashboards/Dashboard')));

// Operaciones
const Reservas     = Loadable(lazy(() => import('../views/operacion/Reservas')));
const Prestamos    = Loadable(lazy(() => import('../views/operacion/Prestamos')));
const Devoluciones = Loadable(lazy(() => import('../views/operacion/Devoluciones')));
const Inventario   = Loadable(lazy(() => import('../views/operacion/Inventario')));
const Reportes     = Loadable(lazy(() => import('../views/operacion/Reportes')));

// Utilities
const Typography = Loadable(lazy(() => import("../views/typography/Typography")));
const Table      = Loadable(lazy(() => import("../views/tables/Table")));
const Alert      = Loadable(lazy(() => import("../views/alerts/Alerts")));
const Perfil     = Loadable(lazy(() => import("../views/perfil/Perfil")));

// Icons
const Solar = Loadable(lazy(() => import("../views/icons/Solar")));

// Auth
const Login      = Loadable(lazy(() => import('../views/auth/login/Login')));
const Register   = Loadable(lazy(() => import('../views/auth/register/Register')));
const SamplePage = Loadable(lazy(() => import('../views/sample-page/SamplePage')));
const ErrorPage  = Loadable(lazy(() => import('../views/auth/error/Error')));

// Labs
const LabDetail = Loadable(lazy(() => import('../views/labs/LabDetail')));
const MisSolicitudes = Loadable(lazy(() => import('../views/operacion/MisSolicitudes')));

const Router = [
  // Área protegida
  {
    path: '/',
    element: (
      <Protected>
        <FullLayout />
      </Protected>
    ),
    children: [
      { path: '/',               exact: true, element: <Dashboard /> },

      // Operación
      { path: '/app/reservas',      element: <Reservas /> },
      { path: '/app/mis-solicitudes', element: <MisSolicitudes /> },
      { path: '/app/prestamos',     element: <Prestamos /> },
      { path: '/app/devoluciones',  element: <Devoluciones /> },
      { path: '/app/inventario',    element: <Inventario /> },
      { path: '/app/reportes',      element: <Reportes /> },

      // Perfil
      { path: '/app/perfil',        element: <Perfil /> },

      // Utilities (si las mantienes)
      { path: '/ui/typography', exact: true, element: <Typography/> },
      { path: '/ui/table',      exact: true, element: <Table/> },
      { path: '/ui/alert',      exact: true, element: <Alert/> },
      { path: '/icons/solar',   exact: true, element: <Solar /> },
      { path: '/sample-page',   exact: true, element: <SamplePage /> },

      // Labs
      { path: '/app/labs/:id', element: <LabDetail /> },

      { path: '*', element: <Navigate to="/auth/404" /> },
    ],
  },

  // Auth público
  {
    path: '/',
    element: <BlankLayout />,
    children: [
      { path: '/auth/login',    element: <Login /> },
      { path: '/auth/register', element: <Register /> },
      { path: '/auth/404',      element: <ErrorPage /> },
      { path: '404',            element: <ErrorPage /> },
      { path: '*',              element: <Navigate to="/auth/404" /> },
    ],
  },
];

const router = createBrowserRouter(Router);
export default router;
