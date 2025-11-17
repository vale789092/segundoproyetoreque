// modulo4_1.routes.js
import { Router } from "express";
import {
  postAssignRole,
  postDeactivateUser,
  postActivateUser,
} from "./modulo4_1.controller.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";

export const rolesAdminRouter = Router();

rolesAdminRouter.use(requireAuth);

// Solo administradores pueden asignar roles
rolesAdminRouter.post(
  "/users/:userId/role",
  requireRole(["admin"]),
  postAssignRole
);

// Baja (desactivar)
rolesAdminRouter.post(
  "/users/:userId/deactivate",
  requireRole(["admin"]),
  postDeactivateUser
);

// Alta (activar)
rolesAdminRouter.post(
  "/users/:userId/activate",
  requireRole(["admin"]),
  postActivateUser
);

export default rolesAdminRouter;
