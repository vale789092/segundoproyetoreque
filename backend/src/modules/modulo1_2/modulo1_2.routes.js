import { Router } from "express";
import * as H from "./modulo1_2.controller.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";

const router = Router();

router.use(requireAuth);
// 1.2.1 — Horario base semanal (por laboratorio)

/** ===== BITÁCORA (filtra por :labId) ===== */
router.get("/:labId/history",     requireRole(["admin"]), H.listHistory);   // JSON
router.get("/:labId/history.pdf", requireRole(["admin"]), H.historyPdf); 

router.post("/:labId/horarios", requireRole(["admin"]),  H.createHorario);
router.get("/:labId/horarios", H.listHorarios);
router.patch("/:labId/horarios/:slotId", requireRole(["admin"]), H.updateHorario);
router.delete("/:labId/horarios/:slotId", requireRole(["admin"]), H.deleteHorario);
router.patch("/:labId/horarios/:slotId", H.updateHorario);
router.delete("/:labId/horarios/:slotId", H.deleteHorario);
router.get("/:labId/horarios/bloqueos", H.listBloqueos);
router.post("/:labId/horarios/bloqueos", H.createBloqueo);
router.delete("/:labId/horarios/bloqueos/:bloqueoId", H.deleteBloqueo);


export default router;
