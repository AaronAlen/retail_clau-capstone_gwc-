"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");

const floorSwapSchema = new mongoose_1.Schema({
    swapMode: { type: String, enum: ["cupboard", "hero_showcase"], required: true },
    activePairId: { type: String, required: true },
    spotIndex: { type: Number, default: 0 },
    stationName: { type: String },
    status: { type: String, enum: ["active", "reverted"], default: "active" },
    staffName: { type: String, default: "Floor Staff" },
    executedItems: [
        {
            productId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Product", required: true },
            productName: { type: String },
            sku: { type: String },
            category: { type: String },
            role: { type: String },
            originalCoords: {
                x: Number,
                y: Number,
                z: Number,
                zone: String,
            },
            targetCoords: {
                x: Number,
                y: Number,
                z: Number,
                zone: String,
            },
            executedAt: { type: Date, default: Date.now },
        }
    ],
    displacedItems: [
        {
            productId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Product" },
            targetCoords: {
                x: Number,
                y: Number,
                z: Number,
                zone: String,
            },
        }
    ],
    revertedAt: { type: Date },
}, { timestamps: true });

floorSwapSchema.index({ status: 1, activePairId: 1 });
exports.default = (0, mongoose_1.model)("FloorSwap", floorSwapSchema);
