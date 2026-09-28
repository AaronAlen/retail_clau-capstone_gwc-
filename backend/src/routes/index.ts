import { Router } from "express";
import authRoutes from "./auth.routes";
import productRoutes from "./product.routes";
import analyticsRoutes from "./analytics.routes";
import recommendationRoutes from "./recommendation.routes";
import userRoutes from "./user.routes";
import copilotRoutes from "./copilot.routes";
import uploadRoutes from "./upload.routes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/products", productRoutes);
router.use("/analytics", analyticsRoutes);
router.use("/recommendations", recommendationRoutes);
router.use("/users", userRoutes);
router.use("/copilot", copilotRoutes);
router.use("/upload", uploadRoutes);

export default router;
