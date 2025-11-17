import { Router } from "express";
import {
  searchUsers,
  adminUpdateUser,
  adminDeactivateUser,
} from "./users.controller.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";

const router = Router();

// /api/users/search
router.get("/search", requireAuth, searchUsers);

// /api/admin/users/:userId 
router.patch("/:userId", requireAuth, requireRole(["admin"]), adminUpdateUser);

// /api/admin/users/:userId/deactivate
router.post(
  "/:userId/deactivate",
  requireAuth,
  requireRole(["admin"]),
  adminDeactivateUser
);

export default router;
