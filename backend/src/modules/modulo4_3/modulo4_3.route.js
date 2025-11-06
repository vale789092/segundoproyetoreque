import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { getLabAudit, getMaintenanceAudit, exportLabsAudit, exportMaintenanceAudit } from "./modulo4_3.controller.js";

export const modulo4_3Router = Router();

modulo4_3Router.use(requireAuth);

// 4.3.1 — Bitácora de actividad (solo ADMIN)
modulo4_3Router.get("/audit/labs",        requireRole(["admin"]), getLabAudit);
modulo4_3Router.get("/audit/maintenance", requireRole(["admin"]), getMaintenanceAudit);

// 4.3.3 — Exportación (PDF/XLSX)
modulo4_3Router.get("/audit/labs/export",        requireRole(["admin"]), exportLabsAudit);
modulo4_3Router.get("/audit/maintenance/export", requireRole(["admin"]), exportMaintenanceAudit);


export default modulo4_3Router;
