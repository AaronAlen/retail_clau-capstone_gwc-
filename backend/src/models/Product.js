"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const productSchema = new mongoose_1.Schema({
    name: { type: String, required: true, trim: true },
    sku: { type: String, required: true, unique: true },
    category: { type: String, required: true, index: true },
    color: { type: String, required: true, index: true },
    tags: { type: [String], default: [] },
    price: { type: Number, required: true, min: 0 },
    stock: { type: Number, required: true, min: 0, default: 0 },
    imageUrl: { type: String },
    coordinates3D: {
        x: { type: Number },
        y: { type: Number },
        z: { type: Number },
        zone: { type: String },
        shelf: { type: String },
        slot: { type: Number },
        isRelocated: { type: Boolean, default: false },
    },
}, { timestamps: true });
productSchema.index({ category: 1, color: 1 });
exports.default = (0, mongoose_1.model)("Product", productSchema);
//# sourceMappingURL=Product.js.map