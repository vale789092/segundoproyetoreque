// modules/modulo1_3/modulo1_3.routes.js
import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { getPrestamos, patchRegistrarDevolucion } from "./modulo1_3.controller.js";

const prestamosRouter = Router();
prestamosRouter.use(requireAuth);

prestamosRouter.get(
  "/",
  requireRole(["profesor", "tecnico", "admin"]),
  getPrestamos
);

prestamosRouter.patch(
  "/:prestamoId/devolucion",
  requireRole(["estudiante", "profesor", "tecnico", "admin"]),
  patchRegistrarDevolucion
);

export default prestamosRouter;
