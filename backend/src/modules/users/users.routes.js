import { Router } from "express";
import { searchUsers } from "./users.controller.js";
import { requireAuth } from "../../middleware/auth.js";

const router = Router();

router.get("/search", requireAuth, searchUsers);

export default router;
