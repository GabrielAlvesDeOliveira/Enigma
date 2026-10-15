import { Router } from "express";
import * as puzzleController from "../controllers/puzzleController.js";
import { authenticate } from "../middlewares/authenticate.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// Montada em /api/rooms/:id/puzzles (mergeParams deixa o :id disponível aqui).
const router = Router({ mergeParams: true });

router.use(authenticate);

router.get("/", asyncHandler(puzzleController.list));
router.get("/:key", asyncHandler(puzzleController.show));
router.post("/:key/answer", asyncHandler(puzzleController.answer));

export default router;
