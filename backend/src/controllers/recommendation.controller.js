"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetPlanogram = exports.applyPlanogram = exports.getPlanogramState = exports.getSimilarForProduct = exports.getRecommendations = void 0;
const express_async_handler_1 = __importDefault(require("express-async-handler"));
const velocity_service_1 = require("../services/velocity.service");
const recommendation_service_1 = require("../services/recommendation.service");
const Planogram_1 = __importDefault(require("../models/Planogram"));
const Product_1 = __importDefault(require("../models/Product"));
const sockets_1 = require("../sockets");
exports.getRecommendations = (0, express_async_handler_1.default)(async (req, res) => {
    const useAI = req.query.ai === "true";
    const results = await (0, velocity_service_1.computeVelocity)(7);
    const fastMovers = results.filter((r) => r.isFastMover).slice(0, 10);
    const recommendations = await (0, recommendation_service_1.buildRecommendationsForFastMovers)(fastMovers, useAI);
    res.json(recommendations);
});
exports.getSimilarForProduct = (0, express_async_handler_1.default)(async (req, res) => {
    const similar = await (0, recommendation_service_1.getSimilarProducts)(req.params.id, 6);
    res.json(similar);
});
exports.getPlanogramState = (0, express_async_handler_1.default)(async (req, res) => {
    let planogram = await Planogram_1.default.findOne().sort({ updatedAt: -1 });
    if (!planogram) {
        planogram = await Planogram_1.default.create({
            activePairId: "sug-1",
            applied: false,
            lift: "+82%",
            sourceCoordinates: { x: -2.2, y: 1.8, z: 0.5, zone: "Hero Runway A-1" },
            originalPairedCoordinates: { x: 12.5, y: 2.0, z: -13.5, zone: "Premium Denim Wall" },
            swappedPairedCoordinates: { x: -1.4, y: 1.8, z: 0.5, zone: "Hero Runway A-1" },
        });
    }
    res.json(planogram);
});
exports.applyPlanogram = (0, express_async_handler_1.default)(async (req, res) => {
    const { activePairId, swapMode, spotId, spotName, sourceProductId, pairedProductId, lift, sourceCoordinates, originalPairedCoordinates, swappedPairedCoordinates, suggestedCoordinatesList, } = req.body;
    let planogram = await Planogram_1.default.findOne().sort({ updatedAt: -1 });
    if (!planogram) {
        planogram = new Planogram_1.default();
    }
    planogram.activePairId = activePairId || "sug-1";
    if (swapMode)
        planogram.swapMode = swapMode;
    if (spotId)
        planogram.spotId = spotId;
    if (spotName)
        planogram.spotName = spotName;
    planogram.sourceProductId = sourceProductId;
    planogram.pairedProductId = pairedProductId;
    planogram.applied = true;
    planogram.lift = lift || "+82%";
    if (sourceCoordinates)
        planogram.sourceCoordinates = sourceCoordinates;
    if (originalPairedCoordinates)
        planogram.originalPairedCoordinates = originalPairedCoordinates;
    if (swappedPairedCoordinates)
        planogram.swappedPairedCoordinates = swappedPairedCoordinates;
    if (suggestedCoordinatesList)
        planogram.suggestedCoordinatesList = suggestedCoordinatesList;
    await planogram.save();
    // Persist updated 3D coordinates in Product collection in MongoDB
    if (pairedProductId && swappedPairedCoordinates) {
        await Product_1.default.findByIdAndUpdate(pairedProductId, {
            coordinates3D: {
                x: swappedPairedCoordinates.x,
                y: swappedPairedCoordinates.y,
                z: swappedPairedCoordinates.z,
                zone: swappedPairedCoordinates.zone || "Hero Runway A-1 (Swapped)",
                isRelocated: true,
            },
        });
    }
    if (sourceProductId && sourceCoordinates) {
        await Product_1.default.findByIdAndUpdate(sourceProductId, {
            coordinates3D: {
                x: sourceCoordinates.x,
                y: sourceCoordinates.y,
                z: sourceCoordinates.z,
                zone: sourceCoordinates.zone || "Hero Runway A-1 (Anchor)",
                isRelocated: false,
            },
        });
    }
    try {
        (0, sockets_1.getIO)().emit("planogram_updated", planogram);
    }
    catch { }
    res.json(planogram);
});
exports.resetPlanogram = (0, express_async_handler_1.default)(async (req, res) => {
    let planogram = await Planogram_1.default.findOne().sort({ updatedAt: -1 });
    if (planogram) {
        planogram.applied = false;
        await planogram.save();
        // Revert product coordinates in MongoDB
        if (planogram.pairedProductId && planogram.originalPairedCoordinates) {
            await Product_1.default.findByIdAndUpdate(planogram.pairedProductId, {
                coordinates3D: {
                    x: planogram.originalPairedCoordinates.x,
                    y: planogram.originalPairedCoordinates.y,
                    z: planogram.originalPairedCoordinates.z,
                    zone: planogram.originalPairedCoordinates.zone || "Original Department Shelf",
                    isRelocated: false,
                },
            });
        }
        try {
            (0, sockets_1.getIO)().emit("planogram_updated", planogram);
        }
        catch { }
    }
    res.json(planogram || { applied: false });
});
//# sourceMappingURL=recommendation.controller.js.map