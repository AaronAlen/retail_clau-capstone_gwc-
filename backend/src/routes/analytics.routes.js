"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const analytics_controller_1 = require("../controllers/analytics.controller");
const router = (0, express_1.Router)();
router.use(auth_1.protect);
router.get("/velocity", analytics_controller_1.getVelocity);
router.get("/fast-movers", analytics_controller_1.getFastMovers);
router.get("/summary", analytics_controller_1.getDashboardSummary);
exports.default = router;
//# sourceMappingURL=analytics.routes.js.map