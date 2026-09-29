"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_routes_1 = __importDefault(require("./auth.routes"));
const product_routes_1 = __importDefault(require("./product.routes"));
const analytics_routes_1 = __importDefault(require("./analytics.routes"));
const recommendation_routes_1 = __importDefault(require("./recommendation.routes"));
const user_routes_1 = __importDefault(require("./user.routes"));
const copilot_routes_1 = __importDefault(require("./copilot.routes"));
const upload_routes_1 = __importDefault(require("./upload.routes"));
const router = (0, express_1.Router)();
router.use("/auth", auth_routes_1.default);
router.use("/products", product_routes_1.default);
router.use("/analytics", analytics_routes_1.default);
router.use("/recommendations", recommendation_routes_1.default);
router.use("/users", user_routes_1.default);
router.use("/copilot", copilot_routes_1.default);
router.use("/upload", upload_routes_1.default);
exports.default = router;
//# sourceMappingURL=index.js.map