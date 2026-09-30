import { Router } from "express";
import { protect } from "../middleware/auth";
import { authorize } from "../middleware/role";
import {
  getRecommendations,
  recalculateRecommendations,
  getSimilarForProduct,
  getPlanogramState,
  applyPlanogram,
  resetPlanogram,
} from "../controllers/recommendation.controller";

const router = Router();
router.use(protect);
router.get("/", getRecommendations);
router.post("/recalculate", authorize("admin", "manager"), recalculateRecommendations);
router.get("/planogram", getPlanogramState);
router.post("/apply-planogram", applyPlanogram);
router.post("/reset-planogram", resetPlanogram);
router.get("/:id/similar", getSimilarForProduct);

export default router;
