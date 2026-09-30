"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.revertFloorSwap = exports.getFloorSwaps = exports.executeFloorSwap = exports.resetPlanogram = exports.applyPlanogram = exports.getPlanogramState = exports.getSimilarForProduct = exports.getRecommendations = void 0;
const express_async_handler_1 = __importDefault(require("express-async-handler"));
const velocity_service_1 = require("../services/velocity.service");
const recommendation_service_1 = require("../services/recommendation.service");
const Planogram_1 = __importDefault(require("../models/Planogram"));
const Product_1 = __importDefault(require("../models/Product"));
const FloorSwap_1 = __importDefault(require("../models/FloorSwap"));
const sockets_1 = require("../sockets");
const updateCoordinates_1 = require("../utils/updateCoordinates");
exports.getRecommendations = (0, express_async_handler_1.default)(async (req, res) => {
    try {
        const useAI = req.query.ai === "true";
        const results = await (0, velocity_service_1.computeVelocity)(7);
        
        // 🌟 Balance fast-movers across all 5 store departments (Jackets, Shirts, Jeans, T-Shirts, Shoes)
        const normalizeCategory = (cat) => {
            const c = (cat || "").toLowerCase();
            if (c.includes("jacket") || c.includes("coat") || c.includes("blazer")) return "Jackets";
            if (c.includes("t-shirt") || c.includes("tee")) return "T-Shirts";
            if (c.includes("shirt") || c.includes("oxford") || c.includes("linen")) return "Shirts";
            if (c.includes("jean") || c.includes("denim") || c.includes("trouser")) return "Jeans";
            if (c.includes("shoe") || c.includes("boot") || c.includes("loafer") || c.includes("sneaker")) return "Shoes";
            return cat;
        };

        const storeDepartments = ["Jackets", "Shirts", "Jeans", "T-Shirts", "Shoes"];

        // 🌟 Construct exactly 8 strategic store merchandising pairs:
        // - Pairs 1 to 3 (Indices 0, 1, 2): 3 Premier Hero Runway Mannequin Outfits
        // - Pairs 4 to 8 (Indices 3, 4, 5, 6, 7): 5 In-Aisle Cupboard Bays (Jackets, Shirts, Jeans, T-Shirts, Shoes)
        const sortedOverall = [...results].sort((a, b) => b.velocityPerDay - a.velocityPerDay);

        // 1. Pick Top 3 overall fast-movers for Hero Runway Stations 1, 2, 3
        const heroRunwayFastMovers = [];
        const allocatedIds = new Set();

        for (const fm of sortedOverall) {
            if (heroRunwayFastMovers.length >= 3) break;
            heroRunwayFastMovers.push(fm);
            allocatedIds.add(String(fm.product._id));
        }

        // 2. Pick 1 top fast-mover from each of the 5 distinct store departments for Cupboards 1 to 5
        const cupboardFastMovers = [];
        storeDepartments.forEach((dept) => {
            const deptItems = results.filter((r) => normalizeCategory(r.product?.category) === dept);
            deptItems.sort((a, b) => b.velocityPerDay - a.velocityPerDay);

            const candidate = deptItems.find((it) => !allocatedIds.has(String(it.product._id))) || deptItems[0];
            if (candidate) {
                cupboardFastMovers.push(candidate);
                allocatedIds.add(String(candidate.product._id));
            }
        });

        // Exactly 8 pairs: 3 Hero Runway + 5 Cupboard Bays
        const final8FastMovers = [...heroRunwayFastMovers, ...cupboardFastMovers].slice(0, 8);

        const recommendations = await (0, recommendation_service_1.buildRecommendationsForFastMovers)(final8FastMovers, useAI);
        res.json(recommendations);
    } catch (err) {
        console.error("Error generating recommendations, falling back:", err);
        try {
            const products = await Product_1.default.find().limit(5);
            const fallback = products.map((p) => ({
                sourceProduct: p,
                similarProducts: [],
                reason: `${p.name} recommended based on current store demand.`,
            }));
            res.json(fallback);
        } catch {
            res.json([]);
        }
    }
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
    // AI Planogram is a purely local visual preview/simulation.
    // Database updates and WebSocket broadcasts are strictly reserved for Floor Tasks
    // so physical ground-level actions and staff attributions are accurately tracked.
    res.json({
        success: true,
        previewOnly: true,
        message: "AI Planogram is visual simulation only; DB & WebSockets updates reserved for Floor Tasks.",
    });
});
exports.resetPlanogram = (0, express_async_handler_1.default)(async (req, res) => {
    // AI Planogram is a purely local visual preview/simulation.
    // Resetting physical store layout is strictly handled via Floor Tasks revert endpoint.
    res.json({
        success: true,
        previewOnly: true,
        message: "Visual preview reset locally; DB & WebSockets updates reserved for Floor Tasks.",
    });
});
exports.executeFloorSwap = (0, express_async_handler_1.default)(async (req, res) => {
    const {
        swapMode,
        activePairId,
        spotIndex,
        executedItems, // Array of { productId, productName, role, targetCoords, originalCoords }
        displacedItems, // Array of { productId, targetCoords }
        staffName,
    } = req.body;

    if (!executedItems || !Array.isArray(executedItems) || executedItems.length === 0) {
        res.status(400);
        throw new Error("No executed items provided for floor swap");
    }

    // 1. Update coordinates in MongoDB for executed items
    for (const item of executedItems) {
        if (item.productId && item.targetCoords) {
            await Product_1.default.findByIdAndUpdate(item.productId, {
                coordinates3D: {
                    x: item.targetCoords.x,
                    y: item.targetCoords.y,
                    z: item.targetCoords.z,
                    zone: item.targetCoords.zone || "Showroom Runway Slot",
                    isRelocated: true,
                },
            });
        }
    }

    // 2. Update coordinates in MongoDB for displaced items if any
    if (displacedItems && Array.isArray(displacedItems)) {
        for (const item of displacedItems) {
            if (item.productId && item.targetCoords) {
                await Product_1.default.findByIdAndUpdate(item.productId, {
                    coordinates3D: {
                        x: item.targetCoords.x,
                        y: item.targetCoords.y,
                        z: item.targetCoords.z,
                        zone: item.targetCoords.zone || "Donor Cupboard Shelf",
                        isRelocated: true,
                    },
                });
            }
        }
    }

    // 3. Save / Update in dedicated FloorSwap MongoDB Collection
    try {
        await FloorSwap_1.default.create({
            swapMode: swapMode || "hero_showcase",
            activePairId: activePairId || "sug-1",
            spotIndex: typeof spotIndex === "number" ? spotIndex : 0,
            status: "active",
            staffName: staffName || req.user?.name || "Floor Staff",
            executedItems,
            displacedItems: displacedItems || [],
        });
    } catch (fsErr) {
        console.error("Failed to persist FloorSwap collection record:", fsErr);
    }

    // 4. Update Planogram state in MongoDB
    let planogram = await Planogram_1.default.findOne().sort({ updatedAt: -1 });
    if (!planogram) {
        planogram = new Planogram_1.default();
    }
    planogram.applied = true;
    if (swapMode) planogram.swapMode = swapMode;
    if (activePairId) planogram.activePairId = activePairId;
    await planogram.save();

    const payload = {
        swapMode: swapMode || "hero_showcase",
        activePairId: activePairId || "sug-1",
        spotIndex: typeof spotIndex === "number" ? spotIndex : 0,
        executedItems,
        displacedItems: displacedItems || [],
        staffName: staffName || req.user?.name || "Floor Staff",
        timestamp: new Date().toISOString(),
    };

    // 5. Broadcast live WebSocket event so manager's laptop animates in real-time
    try {
        (0, sockets_1.getIO)().emit("floor_swap_executed", payload);
        (0, sockets_1.getIO)().emit("planogram_updated", planogram);
        (0, sockets_1.getIO)().emit("product:updated");
    } catch (err) {
        console.error("Socket emit failed:", err);
    }

    res.json({
        success: true,
        message: `Successfully executed & synced ${executedItems.length} floor swap(s)`,
        payload,
    });
});

// 📋 Get all currently active Floor Swaps from MongoDB
exports.getFloorSwaps = (0, express_async_handler_1.default)(async (req, res) => {
    const activeSwaps = await FloorSwap_1.default.find({ status: "active" }).sort({ createdAt: -1 });
    res.json(activeSwaps);
});

// 🔄 Revert/Reset a Floor Swap in MongoDB (Per Item or Entire Station)
exports.revertFloorSwap = (0, express_async_handler_1.default)(async (req, res) => {
    const { productId, activePairId, spotIndex } = req.body;
    const revertedProductIds = [];

    if (productId) {
        // Revert specific single product
        const product = await Product_1.default.findById(productId);
        if (product) {
            const floorRecord = await FloorSwap_1.default.findOne({
                status: "active",
                "executedItems.productId": productId,
            });
            const itemRecord = floorRecord?.executedItems.find((it) => String(it.productId) === String(productId));
            const orig = itemRecord?.originalCoords;

            await Product_1.default.findByIdAndUpdate(productId, {
                coordinates3D: {
                    x: orig?.x ?? product.coordinates3D?.x,
                    y: orig?.y ?? product.coordinates3D?.y,
                    z: orig?.z ?? product.coordinates3D?.z,
                    zone: orig?.zone ?? "Shelf Slot",
                    isRelocated: false,
                },
            });
            revertedProductIds.push(String(productId));

            if (floorRecord) {
                floorRecord.executedItems = floorRecord.executedItems.filter((it) => String(it.productId) !== String(productId));
                if (floorRecord.executedItems.length === 0) {
                    floorRecord.status = "reverted";
                    floorRecord.revertedAt = new Date();
                }
                await floorRecord.save();
            }
        }
    } else if (activePairId || typeof spotIndex === "number") {
        // Revert all products in the active station / pair
        const query = { status: "active" };
        if (activePairId) query.activePairId = activePairId;
        if (typeof spotIndex === "number") query.spotIndex = spotIndex;

        const records = await FloorSwap_1.default.find(query);
        for (const rec of records) {
            for (const it of rec.executedItems) {
                const orig = it.originalCoords;
                await Product_1.default.findByIdAndUpdate(it.productId, {
                    coordinates3D: {
                        x: orig?.x,
                        y: orig?.y,
                        z: orig?.z,
                        zone: orig?.zone || "Original Shelf Slot",
                        isRelocated: false,
                    },
                });
                revertedProductIds.push(String(it.productId));
            }
            for (const d of rec.displacedItems) {
                if (d.productId) {
                    await Product_1.default.findByIdAndUpdate(d.productId, {
                        "coordinates3D.isRelocated": false,
                    });
                    revertedProductIds.push(String(d.productId));
                }
            }
            rec.status = "reverted";
            rec.revertedAt = new Date();
            await rec.save();
        }
    }

    const remainingActive = await FloorSwap_1.default.countDocuments({ status: "active" });
    if (remainingActive === 0) {
        await Planogram_1.default.updateMany({}, { applied: false });
    }

    const payload = {
        revertedProductIds,
        activePairId,
        spotIndex,
        remainingActive,
        staffName: req.body?.staffName || req.user?.name || "Floor Staff",
        timestamp: new Date().toISOString(),
    };

    try {
        (0, sockets_1.getIO)().emit("floor_swap_reverted", payload);
        (0, sockets_1.getIO)().emit("product:updated");
    } catch (err) {
        console.error("Socket emit failed on revert:", err);
    }

    res.json({
        success: true,
        message: `Successfully reverted ${revertedProductIds.length} floor swap item(s)`,
        payload,
    });
});
//# sourceMappingURL=recommendation.controller.js.map