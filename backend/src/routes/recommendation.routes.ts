import { Router } from "express";
import { protect } from "../middleware/auth";
import {
  getRecommendations,
  getSimilarForProduct,
  getPlanogramState,
  applyPlanogram,
  resetPlanogram,
} from "../controllers/recommendation.controller";

const router = Router();
router.use(protect);
router.get("/", getRecommendations);
router.get("/planogram", getPlanogramState);
router.post("/apply-planogram", applyPlanogram);
router.post("/reset-planogram", resetPlanogram);
router.get("/:id/similar", getSimilarForProduct);

export default router;
