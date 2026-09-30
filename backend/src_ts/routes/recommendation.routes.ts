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
  executeFloorSwap,
  getFloorSwaps,
  revertFloorSwap,
  resetAllShowroomSwaps,
} from "../controllers/recommendation.controller";

const router = Router();
router.use(protect);
router.get("/", getRecommendations);
router.post("/recalculate", authorize("admin", "manager"), recalculateRecommendations);
router.get("/planogram", getPlanogramState);
router.post("/apply-planogram", applyPlanogram);
router.post("/floor-swap", executeFloorSwap);
router.get("/floor-swaps", getFloorSwaps);
router.post("/floor-swap/revert", revertFloorSwap);
router.post("/reset-all-showroom", authorize("admin", "manager"), resetAllShowroomSwaps);
router.post("/reset-planogram", resetPlanogram);
router.get("/:id/similar", getSimilarForProduct);

export default router;
