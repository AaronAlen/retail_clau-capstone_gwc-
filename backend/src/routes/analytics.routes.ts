import { Router } from "express";
import { protect } from "../middleware/auth";
import { getVelocity, getFastMovers, getDashboardSummary } from "../controllers/analytics.controller";

const router = Router();
router.use(protect);
router.get("/velocity", getVelocity);
router.get("/fast-movers", getFastMovers);
router.get("/summary", getDashboardSummary);

export default router;
