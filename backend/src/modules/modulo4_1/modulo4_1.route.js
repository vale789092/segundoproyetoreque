import { Router } from "express";
import { postAssignRole, postDeactivateUser } from "./modulo4_1.controller.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";

export const rolesAdminRouter = Router();

rolesAdminRouter.use(requireAuth);

// Solo administradores pueden asignar roles
rolesAdminRouter.post(
  "/users/:userId/role",
  requireRole(["admin"]),
  postAssignRole
);

rolesAdminRouter.post("/users/:userId/deactivate", requireRole(["admin"]), postDeactivateUser);

export default rolesAdminRouter;
