"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const recommendation_controller_1 = require("../controllers/recommendation.controller");
const router = (0, express_1.Router)();
router.use(auth_1.protect);
router.get("/", recommendation_controller_1.getRecommendations);
router.get("/planogram", recommendation_controller_1.getPlanogramState);
router.post("/apply-planogram", recommendation_controller_1.applyPlanogram);
router.post("/reset-planogram", recommendation_controller_1.resetPlanogram);
router.get("/:id/similar", recommendation_controller_1.getSimilarForProduct);
exports.default = router;
//# sourceMappingURL=recommendation.routes.js.map