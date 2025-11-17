// backend/src/modules/modulo3_3/modulo3_3.routes.js
import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import * as C from "./modulo3_3.controller.js";
import {
  approveSolicitud,
} from "./modulo3_3.controller.js";

const router = Router();
router.use(requireAuth);

// === Admin/tecnico: LISTADO GLOBAL (debe ir ANTES de '/:id') ===
router.get("/admin/all", requireRole(["tecnico","admin"]), C.listRequestsAllCtrl);

// CRUD básico usuario
router.post("/", C.createRequestCtrl);
router.get("/", C.listMyRequestsCtrl);
router.get("/:id", C.getRequestCtrl);
router.patch("/:id", C.updateRequestCtrl);
router.delete("/:id", C.deleteRequestCtrl);

// Estado (técnico/admin)
router.patch("/:id/status", requireRole(["tecnico","admin"]), C.setStatusCtrl);

// Aprobar solicitud → reserva equipo
router.post(
  "/:solicitudId/approve",
  requireRole(["tecnico", "admin"]),
  approveSolicitud
);

export default router;
