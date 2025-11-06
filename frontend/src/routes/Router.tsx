// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import  { lazy } from 'react';
import { Navigate, createBrowserRouter } from "react-router";
import Loadable from 'src/layouts/full/shared/loadable/Loadable';




/* ***Layouts**** */
const FullLayout = Loadable(lazy(() => import('../layouts/full/FullLayout')));
const BlankLayout = Loadable(lazy(() => import('../layouts/blank/BlankLayout')));

// Dashboard
const Dashboard = Loadable(lazy(() => import('../views/dashboards/Dashboard')));

// Operaciones
const Reservas      = Loadable(lazy(() => import('../views/operacion/Reservas')));
const Prestamos     = Loadable(lazy(() => import('../views/operacion/Prestamos')));
const Devoluciones  = Loadable(lazy(() => import('../views/operacion/Devoluciones')));
const Inventario    = Loadable(lazy(() => import('../views/operacion/Inventario')));
const Reportes      = Loadable(lazy(() => import('../views/operacion/Reportes')));

// utilities
const Typography = Loadable(lazy(() => import("../views/typography/Typography")));
const Table = Loadable(lazy(() => import("../views/tables/Table")));
const Alert = Loadable(lazy(() => import("../views/alerts/Alerts")));
const Perfil = Loadable(lazy(() => import("../views/perfil/Perfil")));

// icons
const Solar = Loadable(lazy(() => import("../views/icons/Solar")));

// authentication
const Login = Loadable(lazy(() => import('../views/auth/login/Login')));
const Register = Loadable(lazy(() => import('../views/auth/register/Register')));
const SamplePage = Loadable(lazy(() => import('../views/sample-page/SamplePage')));
const Error = Loadable(lazy(() => import('../views/auth/error/Error')));

const Router = [
  {
    path: '/',
    element: <FullLayout />,
    children: [
      { path: '/', exact: true, element: <Dashboard/> },

      // Rutas de operación
      { path: '/app/reservas', element: <Reservas /> },
      { path: '/app/prestamos', element: <Prestamos /> },
      { path: '/app/devoluciones', element: <Devoluciones /> },
      { path: '/app/inventario', element: <Inventario /> },
      { path: '/app/reportes', element: <Reportes /> },

      // Perfil real
      { path: '/app/perfil', element: <Perfil /> },

      // utilidades (si las quieres mantener)
      { path: '/ui/typography', exact: true, element: <Typography/> },
      { path: '/ui/table', exact: true, element: <Table/> },
      { path: '/ui/alert', exact: true, element: <Alert/> },
      { path: '/icons/solar', exact: true, element: <Solar /> },
      { path: '/sample-page', exact: true, element: <SamplePage /> },
      { path: '*', element: <Navigate to="/auth/404" /> },
    ],
  },
  {
    path: '/',
    element: <BlankLayout />,
    children: [
      { path: '/auth/login', element: <Login /> },
      { path: '/auth/register', element: <Register /> },
      { path: '404', element: <Error /> },
      { path: '/auth/404', element: <Error /> },
      { path: '*', element: <Navigate to="/auth/404" /> },
    ],
  }
  ,
];

const router = createBrowserRouter(Router)

export default router;
