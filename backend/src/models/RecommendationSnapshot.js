"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");

const recommendationSnapshotSchema = new mongoose_1.Schema({
    recommendations: { type: Array, required: true },
    lastCalculatedAt: { type: Date, default: Date.now },
    calculatedBy: {
        userId: { type: String, default: "system" },
        name: { type: String, default: "System" },
        role: { type: String, default: "admin" },
    },
    useAI: { type: Boolean, default: true },
    pairCount: { type: Number, default: 8 },
}, { timestamps: true });

exports.default = (0, mongoose_1.model)("RecommendationSnapshot", recommendationSnapshotSchema);
//# sourceMappingURL=RecommendationSnapshot.js.map
