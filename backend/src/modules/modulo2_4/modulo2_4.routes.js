// backend/src/modules/modulo2_4/modulo2_4.routes.js
import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import {
  inventoryReportCtrl,
  inventoryReportCsvCtrl,
  inventoryReportXlsxCtrl,
  inventoryReportPdfCtrl,
} from "./modulo2_4.controller.js";
import {
  maintenanceReportCtrl,
  maintenanceReportXlsxCtrl,
  maintenanceReportPdfCtrl,
} from "./modulo2_4.mant.controller.js";

const router = Router();
router.use(requireAuth);

// -------- Inventario --------
router.get("/inventory", inventoryReportCtrl);
router.get("/inventory.csv", inventoryReportCsvCtrl);
router.get("/inventory.xlsx", inventoryReportXlsxCtrl);
router.get("/inventory.pdf", inventoryReportPdfCtrl);

// -------- Mantenimiento (x labs / x equipos) --------
router.get("/maintenance", maintenanceReportCtrl);           // JSON
router.get("/maintenance.xlsx", maintenanceReportXlsxCtrl);  // Excel
router.get("/maintenance.pdf", maintenanceReportPdfCtrl);    // PDF

export default router;
