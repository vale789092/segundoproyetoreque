import { Router } from "express";
import { pool } from "../db/index.js";
import authRoutes from "../modules/auth/auth.routes.js";
import { labsRouter } from "../modules/modulo1_1/modulo1_1.routes.js";
import modulo1_2Router from "../modules/modulo1_2/modulo1_2.routes.js";
import modulo3_3 from "../modules/modulo3_3/modulo3_3.routes.js";
import modulo3_4 from "../modules/modulo3_4/modulo3_4.routes.js";
import modulo4_1 from "../modules/modulo4_1/modulo4_1.route.js";
import modulo4_3 from "../modules/modulo4_3/modulo4_3.route.js"
import modulo4_4 from "../modules/modulo4_4/modulo4_4.route.js"

export const router = Router();

router.get("/health", async (_req, res, next) => {
  try {
    const t0 = Date.now();
    await pool.query("SELECT 1");
    res.json({ ok: true, db: "up", latency_ms: Date.now() - t0 });
  } catch (e) { next(e); }
});

router.use("/auth", authRoutes);
router.use("/labs", labsRouter);
router.use("/labs", modulo1_2Router);
router.use("/admin", modulo4_1);
router.use("/admin", modulo4_3);
router.use("/admin/reports", modulo4_4);

// 3.3 Gestión de solicitudes y reservas
router.use("/requests", modulo3_3);

// 3.4 Historial de uso
router.use("/history", modulo3_4);

