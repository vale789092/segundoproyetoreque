import { Router } from "express";
import * as C from "./modulo1_1.controller.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";

export const labsRouter = Router();

labsRouter.use(requireAuth);

/** LABS CRUD */
labsRouter.post("/", requireRole(["admin"]), C.createLab);
labsRouter.get("/", C.listLabs);
labsRouter.get("/:labId", C.getLab);
labsRouter.patch("/:labId", requireRole(["admin","tecnico"]), C.updateLab);
labsRouter.delete("/:labId", requireRole(["admin"]), C.deleteLab);

/** RESPONSABLES (tecnicos_labs) */
labsRouter.post("/:labId/technicians", requireRole(["admin"]), C.addTechnicianToLab);
labsRouter.get("/:labId/technicians", C.listTechniciansOfLab);
labsRouter.patch("/:labId/technicians/:tecLabId", requireRole(["admin"]), C.updateTechnicianAssignment);
labsRouter.delete("/:labId/technicians/:tecLabId", requireRole(["admin"]), C.removeTechnicianFromLab);


/** POLÍTICAS (requisitos) */
labsRouter.post("/:labId/policies", requireRole(["admin"]), C.createPolicy);
labsRouter.get("/:labId/policies",  C.listPolicies);
labsRouter.patch("/:labId/policies/:policyId", requireRole(["admin"]), C.updatePolicy);
labsRouter.delete("/:labId/policies/:policyId", requireRole(["admin"]), C.deletePolicy);

/** BITÁCORA */
labsRouter.get("/:labId/history",requireRole(["admin"]), C.listHistory);

// 1.1.3 Recursos fijos
labsRouter.post("/:labId/equipos", requireRole(["admin"]), C.createEquipo);
labsRouter.get("/:labId/equipos", C.listEquipos);
labsRouter.get("/:labId/equipos/:equipoId", C.getEquipo);
labsRouter.patch("/:labId/equipos/:equipoId", requireRole(["admin"]), C.updateEquipo);
labsRouter.delete("/:labId/equipos/:equipoId", requireRole(["admin"]), C.deleteEquipo);

export default labsRouter;
