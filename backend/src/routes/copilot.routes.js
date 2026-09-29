"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const copilot_controller_1 = require("../controllers/copilot.controller");
const router = (0, express_1.Router)();
router.use(auth_1.protect);
router.post("/chat", copilot_controller_1.chatWithCopilot);
exports.default = router;
//# sourceMappingURL=copilot.routes.js.map