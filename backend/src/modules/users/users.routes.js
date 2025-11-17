import { Router } from "express";
import { searchUsers, adminUpdateUser } from "./users.controller.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";

const router = Router();

// /api/users/search
router.get("/search", requireAuth, searchUsers);

// /api/admin/users/:userId  (se monta bajo /admin/users)
router.patch("/:userId", requireAuth, requireRole(["admin"]), adminUpdateUser);

export default router;
