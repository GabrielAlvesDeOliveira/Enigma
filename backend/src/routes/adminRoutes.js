import { Router } from "express";
import * as historyController from "../controllers/historyController.js";
import { authenticate } from "../middlewares/authenticate.js";
import { requireAdmin } from "../middlewares/requireAdmin.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

// Tudo aqui é exclusivo do mestre.
router.use(authenticate, requireAdmin);

router.get("/rooms", asyncHandler(historyController.adminList));
router.get("/rooms/:id", asyncHandler(historyController.adminDetail));

export default router;
