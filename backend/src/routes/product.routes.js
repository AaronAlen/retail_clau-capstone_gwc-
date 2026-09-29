"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const role_1 = require("../middleware/role");
const product_controller_1 = require("../controllers/product.controller");
const router = (0, express_1.Router)();
router.use(auth_1.protect);
router.get("/", product_controller_1.listProducts);
router.get("/:id", product_controller_1.getProduct);
router.post("/", (0, role_1.authorize)("admin", "manager"), product_controller_1.createProduct);
router.put("/:id", (0, role_1.authorize)("admin", "manager"), product_controller_1.updateProduct);
router.delete("/:id", (0, role_1.authorize)("admin"), product_controller_1.deleteProduct);
router.post("/:id/sale", (0, role_1.authorize)("admin", "manager", "staff"), product_controller_1.recordSale);
exports.default = router;
//# sourceMappingURL=product.routes.js.map