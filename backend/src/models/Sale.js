"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const saleSchema = new mongoose_1.Schema({
    product: { type: mongoose_1.Schema.Types.ObjectId, ref: "Product", required: true, index: true },
    quantity: { type: Number, required: true, min: 1 },
    soldAt: { type: Date, default: Date.now, index: true },
}, { timestamps: true });
exports.default = (0, mongoose_1.model)("Sale", saleSchema);
//# sourceMappingURL=Sale.js.map