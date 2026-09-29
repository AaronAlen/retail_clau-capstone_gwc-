"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const planogramSchema = new mongoose_1.Schema({
    activePairId: { type: String, default: "sug-1" },
    swapMode: { type: String, enum: ["cupboard", "hero_showcase"], default: "cupboard" },
    spotId: { type: String, default: "cupboard-adjacent" },
    spotName: { type: String, default: "Cupboard Adjacency Placement" },
    sourceProductId: { type: String },
    pairedProductId: { type: String },
    applied: { type: Boolean, default: false },
    lift: { type: String, default: "+82%" },
    notes: { type: String, default: "" },
    sourceCoordinates: {
        x: { type: Number },
        y: { type: Number },
        z: { type: Number },
        zone: { type: String },
    },
    originalPairedCoordinates: {
        x: { type: Number },
        y: { type: Number },
        z: { type: Number },
        zone: { type: String },
    },
    swappedPairedCoordinates: {
        x: { type: Number },
        y: { type: Number },
        z: { type: Number },
        zone: { type: String },
    },
    suggestedCoordinatesList: [
        {
            productId: { type: String },
            sku: { type: String },
            name: { type: String },
            x: { type: Number },
            y: { type: Number },
            z: { type: Number },
            zone: { type: String },
        },
    ],
}, { timestamps: true });
exports.default = (0, mongoose_1.model)("Planogram", planogramSchema);
//# sourceMappingURL=Planogram.js.map