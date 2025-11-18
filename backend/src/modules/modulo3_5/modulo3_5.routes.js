// backend/src/modules/modulo3_5/modulo3_5.routes.js
import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import * as C from "./modulo3_5.controller.js";

const router = Router();

router.use(requireAuth);

// GET /notifications
router.get("/", C.listMyNotificationsCtrl);

// PATCH /notifications/:id/read
router.patch("/:id/read", C.markReadCtrl);

// POST /notifications/read-all
router.post("/read-all", C.markAllReadCtrl);

export default router;
