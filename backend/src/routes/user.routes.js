"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const role_1 = require("../middleware/role");
const user_controller_1 = require("../controllers/user.controller");
const router = (0, express_1.Router)();
router.use(auth_1.protect, (0, role_1.authorize)("admin"));
router.get("/", user_controller_1.listUsers);
router.put("/:id/role", user_controller_1.updateUserRole);
router.delete("/:id", user_controller_1.deleteUser);
exports.default = router;
//# sourceMappingURL=user.routes.js.map