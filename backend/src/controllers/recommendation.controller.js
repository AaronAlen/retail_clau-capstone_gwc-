"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetAllShowroomSwaps = exports.recalculateRecommendations = exports.revertFloorSwap = exports.getFloorSwaps = exports.executeFloorSwap = exports.resetPlanogram = exports.applyPlanogram = exports.getPlanogramState = exports.getSimilarForProduct = exports.getRecommendations = void 0;
const express_async_handler_1 = __importDefault(require("express-async-handler"));
const velocity_service_1 = require("../services/velocity.service");
const recommendation_service_1 = require("../services/recommendation.service");
const Planogram_1 = __importDefault(require("../models/Planogram"));
const Product_1 = __importDefault(require("../models/Product"));
const FloorSwap_1 = __importDefault(require("../models/FloorSwap"));
const RecommendationSnapshot_1 = __importDefault(require("../models/RecommendationSnapshot"));
const sockets_1 = require("../sockets");
const updateCoordinates_1 = require("../utils/updateCoordinates");

/**
 * Deterministically computes the canonical home shelf coordinates for any product.
 * Guarantees that reverted or recommended products NEVER have undefined x, y, z or corrupted zones.
 */
const getBaselineCoordsForProduct = (product) => {
    if (!product) return null;
    let indexInCat = 0;
    const nameMatch = (product.name || "").match(/#(\d+)/);
    if (nameMatch && nameMatch[1]) {
        const id = parseInt(nameMatch[1], 10);
        indexInCat = (id - 1) % 12;
    } else {
        const skuNum = parseInt((product.sku || "").replace(/\D/g, ""), 10);
        if (!isNaN(skuNum)) {
            indexInCat = skuNum >= 1001 ? (skuNum - 1001) % 12 : (skuNum - 1) % 12;
        }
    }
    return (0, updateCoordinates_1.computeProductCoordinates)(product.category || "", indexInCat);
};
exports.getBaselineCoordsForProduct = getBaselineCoordsForProduct;

/**
 * Internal computation generator for 8 strategic store pairs
 * (3 Premier Hero Runway Mannequin Outfits + 5 In-Aisle Cupboard Bays)
 */
const generateRecommendationsCalculation = async (useAI = true) => {
    const results = await (0, velocity_service_1.computeVelocity)(7);
    const normalizeCategory = (cat) => {
        const c = (cat || "").toLowerCase();
        if (c.includes("jacket") || c.includes("coat") || c.includes("blazer")) return "Jackets";
        if (c.includes("t-shirt") || c.includes("tee")) return "T-Shirts";
        if (c.includes("shirt") || c.includes("oxford") || c.includes("linen")) return "Shirts";
        if (c.includes("jean") || c.includes("denim") || c.includes("trouser")) return "Jeans";
        if (c.includes("shoe") || c.includes("boot") || c.includes("loafer") || c.includes("sneaker")) return "Shoes";
        return cat || "General";
    };

    const storeDepartments = ["Jackets", "Shirts", "Jeans", "T-Shirts", "Shoes"];
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

    const final8FastMovers = [...heroRunwayFastMovers, ...cupboardFastMovers].slice(0, 8);
    const recommendations = await (0, recommendation_service_1.buildRecommendationsForFastMovers)(final8FastMovers, useAI);

    // SANITIZE: Ensure every product embedded in the recommendations snapshot has pure baseline home coordinates
    recommendations.forEach((rec) => {
        if (rec.sourceProduct) {
            rec.sourceProduct.coordinates3D = getBaselineCoordsForProduct(rec.sourceProduct);
        }
        if (Array.isArray(rec.similarProducts)) {
            rec.similarProducts.forEach((p) => {
                p.coordinates3D = getBaselineCoordsForProduct(p);
            });
        }
    });

    return recommendations;
};

/**
 * GET /api/recommendations
 * Reads the latest saved recommendations snapshot from MongoDB.
 * Does NOT re-calculate unless the database has never been initialized.
 * Fast, deterministic, and consistent for all users.
 */
exports.getRecommendations = (0, express_async_handler_1.default)(async (req, res) => {
    try {
        let snapshot = await RecommendationSnapshot_1.default.findOne().sort({ createdAt: -1 });

        // If no snapshot exists yet in MongoDB (initial cold start), compute once and persist
        if (!snapshot || !snapshot.recommendations || snapshot.recommendations.length === 0) {
            const useAI = req.query.ai === "true";
            const freshRecs = await generateRecommendationsCalculation(useAI);
            snapshot = await RecommendationSnapshot_1.default.create({
                recommendations: freshRecs,
                lastCalculatedAt: new Date(),
                calculatedBy: {
                    userId: req.user?.id || req.user?._id || "system",
                    name: req.user?.name || "System Initializer",
                    role: req.user?.role || "admin",
                },
                useAI,
                pairCount: freshRecs.length,
            });
        }

        // Return snapshot with metadata
        res.json({
            recommendations: snapshot.recommendations,
            lastCalculatedAt: snapshot.lastCalculatedAt,
            calculatedBy: snapshot.calculatedBy,
            pairCount: snapshot.recommendations.length,
            isCached: true,
        });
    } catch (err) {
        console.error("Error retrieving recommendations snapshot:", err);
        try {
            const products = await Product_1.default.find().limit(5);
            const fallback = products.map((p) => ({
                sourceProduct: p,
                similarProducts: [],
                reason: `${p.name} recommended based on current store demand.`,
            }));
            res.json({
                recommendations: fallback,
                lastCalculatedAt: new Date(),
                calculatedBy: { name: "System Fallback", role: "system" },
                pairCount: fallback.length,
                isCached: true,
            });
        } catch {
            res.json({ recommendations: [] });
        }
    }
});

/**
 * POST /api/recommendations/recalculate
 * RESTRICTED: Admin and Store Manager only!
 * Triggers a fresh sales velocity analysis and Groq AI recommendation computation,
 * saving the new snapshot to MongoDB Atlas.
 */
exports.recalculateRecommendations = (0, express_async_handler_1.default)(async (req, res) => {
    // Defense-in-depth role check
    if (!req.user || (req.user.role !== "admin" && req.user.role !== "manager")) {
        return res.status(403).json({
            message: "Forbidden: Only Store Managers and Administrators can trigger recommendation recalculations. Staff users have read-only access.",
        });
    }

    try {
        const useAI = req.query.ai !== "false" && req.body?.ai !== false;
        console.log(`[Recommendations] Continuous cycle recalculation triggered by ${req.user.name} (${req.user.role}) with AI=${useAI}`);

        const freshRecs = await generateRecommendationsCalculation(useAI);

        const snapshot = await RecommendationSnapshot_1.default.create({
            recommendations: freshRecs,
            lastCalculatedAt: new Date(),
            calculatedBy: {
                userId: req.user.id || req.user._id,
                name: req.user.name || "Manager",
                role: req.user.role,
            },
            useAI,
            pairCount: freshRecs.length,
        });

        // Broadcast realtime update to open clients
        try {
            const io = (0, sockets_1.getIO)();
            if (io) {
                io.emit("recommendations:recalculated", {
                    lastCalculatedAt: snapshot.lastCalculatedAt,
                    calculatedBy: snapshot.calculatedBy,
                    pairCount: snapshot.pairCount,
                });
            }
        } catch {}

        res.json({
            message: "Recommendations successfully recalculated and saved to MongoDB.",
            recommendations: snapshot.recommendations,
            lastCalculatedAt: snapshot.lastCalculatedAt,
            calculatedBy: snapshot.calculatedBy,
            pairCount: snapshot.recommendations.length,
            isCached: false,
        });
    } catch (err) {
        console.error("Error recalculating recommendations:", err);
        res.status(500).json({ message: "Failed to recalculate recommendations: " + (err.message || "") });
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

    // 3. Direct Incremental Replacement: Check if this station already had an active swap.
    // If so, restore only the old items being replaced back to their original home shelves!
    try {
        const queryOr = [];
        if (activePairId) queryOr.push({ activePairId });
        if (typeof spotIndex === "number") queryOr.push({ spotIndex });

        if (queryOr.length > 0) {
            const prevRecords = await FloorSwap_1.default.find({
                status: "active",
                $or: queryOr,
            });
            const incomingIds = new Set(executedItems.map((it) => String(it.productId)));
            for (const prevRec of prevRecords) {
                for (const oldIt of prevRec.executedItems) {
                    if (!incomingIds.has(String(oldIt.productId))) {
                        const oldProd = await Product_1.default.findById(oldIt.productId);
                        if (oldProd) {
                            const baseline = getBaselineCoordsForProduct(oldProd);
                            await Product_1.default.findByIdAndUpdate(oldProd._id, {
                                $set: { coordinates3D: baseline },
                            });
                        }
                    }
                }
                for (const oldDisp of (prevRec.displacedItems || [])) {
                    if (!incomingIds.has(String(oldDisp.productId))) {
                        const oldDProd = await Product_1.default.findById(oldDisp.productId);
                        if (oldDProd) {
                            const baseline = getBaselineCoordsForProduct(oldDProd);
                            await Product_1.default.findByIdAndUpdate(oldDProd._id, {
                                $set: { coordinates3D: baseline },
                            });
                        }
                    }
                }
                prevRec.status = "reverted";
                prevRec.revertedAt = new Date();
                await prevRec.save();
            }
        }

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
            const baseline = getBaselineCoordsForProduct(product);
            await Product_1.default.findByIdAndUpdate(productId, {
                $set: { coordinates3D: baseline },
            });
            revertedProductIds.push(String(productId));

            const floorRecord = await FloorSwap_1.default.findOne({
                status: "active",
                "executedItems.productId": productId,
            });

            if (floorRecord) {
                const itemIdx = floorRecord.executedItems.findIndex((it) => String(it.productId) === String(productId));
                if (itemIdx !== -1 && floorRecord.displacedItems && floorRecord.displacedItems[itemIdx]) {
                    const dispItem = floorRecord.displacedItems[itemIdx];
                    if (dispItem.productId) {
                        const dProd = await Product_1.default.findById(dispItem.productId);
                        if (dProd) {
                            const dBaseline = getBaselineCoordsForProduct(dProd);
                            await Product_1.default.findByIdAndUpdate(dispItem.productId, {
                                $set: { coordinates3D: dBaseline },
                            });
                            revertedProductIds.push(String(dispItem.productId));
                        }
                    }
                }
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
                const prod = await Product_1.default.findById(it.productId);
                if (prod) {
                    const baseline = getBaselineCoordsForProduct(prod);
                    await Product_1.default.findByIdAndUpdate(prod._id, {
                        $set: { coordinates3D: baseline },
                    });
                }
                revertedProductIds.push(String(it.productId));
            }
            for (const d of (rec.displacedItems || [])) {
                if (d.productId) {
                    const dProd = await Product_1.default.findById(d.productId);
                    if (dProd) {
                        const dBaseline = getBaselineCoordsForProduct(dProd);
                        await Product_1.default.findByIdAndUpdate(dProd._id, {
                            $set: { coordinates3D: dBaseline },
                        });
                    }
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

// 🔄 Full Store Seasonal Reset: Explicit Manager action to revert all showroom displays back to home shelves
exports.resetAllShowroomSwaps = (0, express_async_handler_1.default)(async (req, res) => {
    // 1. Mark all active floor swaps as reverted
    const swapRes = await FloorSwap_1.default.updateMany(
        { status: "active" },
        { $set: { status: "reverted", revertedAt: new Date() } }
    );

    // 2. Reset all 60 products to baseline shelf coordinates
    await (0, updateCoordinates_1.resetAllProductsToBaselineCoords)();

    // 3. Reset planograms
    await Planogram_1.default.updateMany({}, { $set: { applied: false } });

    // 4. Broadcast live reset to all clients
    try {
        (0, sockets_1.getIO)().emit("floor_swap_reverted", {
            all: true,
            allReset: true,
            staffName: req.user?.name || "Store Manager",
            timestamp: new Date().toISOString(),
        });
        (0, sockets_1.getIO)().emit("product:updated");
    } catch {}

    res.json({
        success: true,
        message: `Seasonal store reset complete: all ${swapRes.modifiedCount} active swaps reverted back to baseline home shelves.`,
    });
});
//# sourceMappingURL=recommendation.controller.js.map