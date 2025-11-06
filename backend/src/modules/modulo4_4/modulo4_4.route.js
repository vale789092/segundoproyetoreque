import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import {
  globalUsageCtrl,
  globalUsageXlsxCtrl,
  globalUsagePdfCtrl,
  inventoryInstitutionalCtrl,
  inventoryInstitutionalXlsxCtrl,
  inventoryInstitutionalPdfCtrl,
} from "./modulo4_4.controller.js";

export const globalUsageRouter = Router();
globalUsageRouter.use(requireAuth, requireRole(["admin"]));

/** JSON */
globalUsageRouter.get("/", globalUsageCtrl);
/** Exports */
globalUsageRouter.get("/export.xlsx", globalUsageXlsxCtrl);
globalUsageRouter.get("/export.pdf",  globalUsagePdfCtrl);

/** JSON (sin filtro por lab; filtros opcionales por tipo/estados/search) */
globalUsageRouter.get("/inventory", inventoryInstitutionalCtrl);
/** Exportaciones */
globalUsageRouter.get("/inventory/export.xlsx", inventoryInstitutionalXlsxCtrl);
globalUsageRouter.get("/inventory/export.pdf",  inventoryInstitutionalPdfCtrl);

export default globalUsageRouter;
