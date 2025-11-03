import { Router } from "express";
import { pool } from "../db/index.js";
import authRoutes from "../modules/auth/auth.routes.js";
import { labsRouter } from "../modules/modulo1_1/modulo1_1.routes.js";
import modulo1_2Router from "../modules/modulo1_2/modulo1_2.routes.js";

import modulo3_2 from "../modules/modulo3_2/modulo3_2.routes.js";
import modulo3_3 from "../modules/modulo3_3/modulo3_3.routes.js";
import modulo3_4 from "../modules/modulo3_4/modulo3_4.routes.js";

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


// 3.2 Búsqueda y disponibilidad
router.use("/search", modulo3_2); 

// 3.3 Gestión de solicitudes y reservas
router.use("/requests", modulo3_3);

// 3.4 Historial de uso
router.use("/history", modulo3_4);

