import { Router } from "express";
import { protect } from "../middleware/auth";
import { chatWithCopilot } from "../controllers/copilot.controller";

const router = Router();
router.use(protect);
router.post("/chat", chatWithCopilot);

export default router;
