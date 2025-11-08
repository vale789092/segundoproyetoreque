import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import {
  myUsageCtrl, myUsageXlsxCtrl, myUsagePdfCtrl,
  globalUsageCtrl, globalUsageXlsxCtrl, globalUsagePdfCtrl,
  inventoryCtrl, inventoryXlsxCtrl
} from "./modulo3_4.controller.js";
import * as C from "./modulo3_4.controller.js";

const router = Router();
router.use(requireAuth);

// ===== personales (ya existentes)
router.get("/my-usage", myUsageCtrl);
router.get("/my-usage.xlsx", myUsageXlsxCtrl);
router.get("/my-usage.pdf", myUsagePdfCtrl);
router.get("/me", C.listMyHistoryCtrl);

// ===== institucionales (profesor | tecnico | admin)
function allowInstitutional(req, res, next) {
  return ["profesor","tecnico","admin"].includes(req.user?.rol)
    ? next()
    : res.status(403).json({ error: "Forbidden" });
}

// uso global
router.get("/global-usage",       allowInstitutional, globalUsageCtrl);
router.get("/global-usage.xlsx",  allowInstitutional, globalUsageXlsxCtrl);
router.get("/global-usage.pdf",   allowInstitutional, globalUsagePdfCtrl);

// inventario institucional
router.get("/inventory",          allowInstitutional, inventoryCtrl);
router.get("/inventory.xlsx",     allowInstitutional, inventoryXlsxCtrl);

export default router;
