import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { myUsageCtrl, myUsageXlsxCtrl, myUsagePdfCtrl } from "./modulo3_4.controller.js"; // 👈 agrega myUsagePdfCtrl

const router = Router();

router.use(requireAuth);

router.get("/my-usage", myUsageCtrl);
router.get("/my-usage.xlsx", myUsageXlsxCtrl);
router.get("/my-usage.pdf", myUsagePdfCtrl); 

export default router;
