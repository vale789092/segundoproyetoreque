import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { myUsageCtrl, myUsageXlsxCtrl, myUsagePdfCtrl } from "./modulo3_4.controller.js"; // 👈 agrega myUsagePdfCtrl
import * as C from "./modulo3_4.controller.js";

const router = Router();

router.use(requireAuth);

router.get("/my-usage", myUsageCtrl);
router.get("/my-usage.xlsx", myUsageXlsxCtrl);
router.get("/my-usage.pdf", myUsagePdfCtrl); 
router.get("/me", C.listMyHistoryCtrl);

export default router;
