// backend/src/modules/modulo2_3/modulo2_3.routes.js
import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import {
  createMaintenanceCtrl,
  updateMaintenanceCtrl,
  addResourcesCtrl,
  removeResourceCtrl,
  getMaintenanceCtrl,
  listMaintenancesCtrl,
  listMaintenanceHistoryCtrl,
} from "./modulo2_3.controller.js";

const router = Router();

router.use(requireAuth);

// Programación / creación
router.post("/", createMaintenanceCtrl);

// Edición registro/scheduling
router.patch("/:id", updateMaintenanceCtrl);

// Recursos N:M
router.post("/:id/resources", addResourcesCtrl);
router.delete("/:id/resources/:equipoId", removeResourceCtrl);

// Consultas
router.get("/", listMaintenancesCtrl);
router.get("/historys", listMaintenanceHistoryCtrl);
router.get("/:id", getMaintenanceCtrl);

export default router;
