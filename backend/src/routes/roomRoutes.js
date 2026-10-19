import { Router } from "express";
import * as roomController from "../controllers/roomController.js";
import * as historyController from "../controllers/historyController.js";
import { authenticate } from "../middlewares/authenticate.js";
import { requireAdmin } from "../middlewares/requireAdmin.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.use(authenticate);

router.post("/", requireAdmin, asyncHandler(roomController.create));
router.post("/join", asyncHandler(roomController.join));
router.get("/mine", asyncHandler(historyController.mine));
router.get("/:id", asyncHandler(roomController.show));
router.post("/:id/start", requireAdmin, asyncHandler(roomController.start));
router.post("/:id/cancel", requireAdmin, asyncHandler(roomController.cancel));
router.post("/:id/leave", asyncHandler(roomController.leave));

export default router;
