import { Response } from "express";
import asyncHandler from "express-async-handler";
import { AuthRequest } from "../types";
import { computeVelocity } from "../services/velocity.service";
import { buildRecommendationsForFastMovers, getSimilarProducts } from "../services/recommendation.service";
import Planogram from "../models/Planogram";
import Product from "../models/Product";
import FloorSwap from "../models/FloorSwap";
import RecommendationSnapshot from "../models/RecommendationSnapshot";
import { getIO } from "../sockets";
import { computeProductCoordinates, resetAllProductsToBaselineCoords } from "../utils/updateCoordinates";

/**
 * Deterministically computes the canonical home shelf coordinates for any product.
 * Guarantees that reverted or recommended products NEVER have undefined x, y, z or corrupted zones.
 */
export const getBaselineCoordsForProduct = (product: any) => {
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
  return computeProductCoordinates(product.category || "", indexInCat);
};

/**
 * Internal computation generator for 8 strategic store pairs
 * (3 Premier Hero Runway Mannequin Outfits + 5 In-Aisle Cupboard Bays)
 */
const generateRecommendationsCalculation = async (useAI = true) => {
  const results = await computeVelocity(7);

  const normalizeCategory = (cat?: string): string => {
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
  const heroRunwayFastMovers: typeof results = [];
  const allocatedIds = new Set<string>();

  for (const fm of sortedOverall) {
    if (heroRunwayFastMovers.length >= 3) break;
    heroRunwayFastMovers.push(fm);
    allocatedIds.add(String(fm.product._id));
  }

  // 2. Pick 1 top fast-mover from each of the 5 distinct store departments for Cupboards 1 to 5
  const cupboardFastMovers: typeof results = [];
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
  const recommendations = await buildRecommendationsForFastMovers(final8FastMovers, useAI);

  // SANITIZE: Ensure every product embedded in the recommendations snapshot has pure baseline home coordinates
  recommendations.forEach((rec: any) => {
    if (rec.sourceProduct) {
      rec.sourceProduct.coordinates3D = getBaselineCoordsForProduct(rec.sourceProduct);
    }
    if (Array.isArray(rec.similarProducts)) {
      rec.similarProducts.forEach((p: any) => {
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
 */
export const getRecommendations = asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    let snapshot = await RecommendationSnapshot.findOne().sort({ createdAt: -1 });

    if (!snapshot || !snapshot.recommendations || snapshot.recommendations.length === 0) {
      const useAI = req.query.ai === "true";
      const freshRecs = await generateRecommendationsCalculation(useAI);
      snapshot = await RecommendationSnapshot.create({
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

    res.json({
      recommendations: snapshot.recommendations,
      lastCalculatedAt: snapshot.lastCalculatedAt,
      calculatedBy: snapshot.calculatedBy,
      pairCount: snapshot.recommendations.length,
      isCached: true,
    });
  } catch (err: any) {
    console.error("Error retrieving recommendations snapshot:", err);
    try {
      const products = await Product.find().limit(5);
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
 */
export const recalculateRecommendations = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user || (req.user.role !== "admin" && req.user.role !== "manager")) {
    res.status(403).json({
      message: "Forbidden: Only Store Managers and Administrators can trigger recommendation recalculations. Staff users have read-only access.",
    });
    return;
  }

  try {
    const useAI = req.query.ai !== "false" && req.body?.ai !== false;
    const freshRecs = await generateRecommendationsCalculation(useAI);

    const snapshot = await RecommendationSnapshot.create({
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

    try {
      const io = getIO();
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
  } catch (err: any) {
    console.error("Error recalculating recommendations:", err);
    res.status(500).json({ message: "Failed to recalculate recommendations: " + (err.message || "") });
  }
});

export const getSimilarForProduct = asyncHandler(async (req: AuthRequest, res: Response) => {
  const similar = await getSimilarProducts(req.params.id, 6);
  res.json(similar);
});

export const getPlanogramState = asyncHandler(async (req: AuthRequest, res: Response) => {
  let planogram = await Planogram.findOne().sort({ updatedAt: -1 });
  if (!planogram) {
    planogram = await Planogram.create({
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

export const applyPlanogram = asyncHandler(async (req: AuthRequest, res: Response) => {
  const {
    activePairId,
    swapMode,
    spotId,
    spotName,
    sourceProductId,
    pairedProductId,
    lift,
    sourceCoordinates,
    originalPairedCoordinates,
    swappedPairedCoordinates,
    suggestedCoordinatesList,
  } = req.body;

  let planogram = await Planogram.findOne().sort({ updatedAt: -1 });
  if (!planogram) {
    planogram = new Planogram();
  }
  planogram.activePairId = activePairId || "sug-1";
  if (swapMode) planogram.swapMode = swapMode;
  if (spotId) planogram.spotId = spotId;
  if (spotName) planogram.spotName = spotName;
  planogram.sourceProductId = sourceProductId;
  planogram.pairedProductId = pairedProductId;
  planogram.applied = true;
  planogram.lift = lift || "+82%";
  if (sourceCoordinates) planogram.sourceCoordinates = sourceCoordinates;
  if (originalPairedCoordinates) planogram.originalPairedCoordinates = originalPairedCoordinates;
  if (swappedPairedCoordinates) planogram.swappedPairedCoordinates = swappedPairedCoordinates;
  if (suggestedCoordinatesList) planogram.suggestedCoordinatesList = suggestedCoordinatesList;
  await planogram.save();

  // Persist updated 3D coordinates in Product collection in MongoDB
  if (pairedProductId && swappedPairedCoordinates) {
    await Product.findByIdAndUpdate(pairedProductId, {
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
    await Product.findByIdAndUpdate(sourceProductId, {
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
    getIO().emit("planogram_updated", planogram);
  } catch {}

  res.json(planogram);
});

export const resetPlanogram = asyncHandler(async (req: AuthRequest, res: Response) => {
  let planogram = await Planogram.findOne().sort({ updatedAt: -1 });
  if (planogram) {
    planogram.applied = false;
    await planogram.save();

    // Revert product coordinates in MongoDB
    if (planogram.pairedProductId && planogram.originalPairedCoordinates) {
      await Product.findByIdAndUpdate(planogram.pairedProductId, {
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
      getIO().emit("planogram_updated", planogram);
    } catch {}
  }
  res.json(planogram || { applied: false });
});

export const executeFloorSwap = asyncHandler(async (req: AuthRequest, res: Response) => {
  const {
    swapMode,
    activePairId,
    spotIndex,
    executedItems,
    displacedItems,
    staffName,
  } = req.body;

  if (!executedItems || !Array.isArray(executedItems) || executedItems.length === 0) {
    res.status(400);
    throw new Error("No executed items provided for floor swap");
  }

  // 1. Update coordinates in MongoDB for executed items
  for (const item of executedItems) {
    if (item.productId && item.targetCoords) {
      await Product.findByIdAndUpdate(item.productId, {
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
        await Product.findByIdAndUpdate(item.productId, {
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
    const queryOr: any[] = [];
    if (activePairId) queryOr.push({ activePairId });
    if (typeof spotIndex === "number") queryOr.push({ spotIndex });

    if (queryOr.length > 0) {
      const prevRecords = await FloorSwap.find({
        status: "active",
        $or: queryOr,
      });
      const incomingIds = new Set(executedItems.map((it: any) => String(it.productId)));
      for (const prevRec of prevRecords) {
        for (const oldIt of prevRec.executedItems) {
          if (!incomingIds.has(String(oldIt.productId))) {
            const oldProd = await Product.findById(oldIt.productId);
            if (oldProd) {
              const baseline = getBaselineCoordsForProduct(oldProd);
              await Product.findByIdAndUpdate(oldProd._id, {
                $set: { coordinates3D: baseline },
              });
            }
          }
        }
        for (const oldDisp of (prevRec.displacedItems || [])) {
          if (!incomingIds.has(String(oldDisp.productId))) {
            const oldDProd = await Product.findById(oldDisp.productId);
            if (oldDProd) {
              const baseline = getBaselineCoordsForProduct(oldDProd);
              await Product.findByIdAndUpdate(oldDProd._id, {
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

    await FloorSwap.create({
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
  let planogram = await Planogram.findOne().sort({ updatedAt: -1 });
  if (!planogram) {
    planogram = new Planogram();
  }
  planogram.applied = true;
  planogram.activePairId = activePairId || "sug-1";
  if (swapMode) planogram.swapMode = swapMode;
  await planogram.save();

  const payload = {
    swapMode,
    activePairId,
    spotIndex,
    executedItems,
    displacedItems,
    staffName: staffName || req.user?.name || "Floor Staff",
    applied: true,
    timestamp: new Date().toISOString(),
  };

  try {
    getIO().emit("floor_swap_executed", payload);
    getIO().emit("product:updated");
  } catch (err) {
    console.error("Socket emit failed:", err);
  }

  res.json({
    success: true,
    message: `Successfully executed & synced ${executedItems.length} floor swap(s)`,
    payload,
  });
});

export const getFloorSwaps = asyncHandler(async (req: AuthRequest, res: Response) => {
  const activeSwaps = await FloorSwap.find({ status: "active" }).sort({ createdAt: -1 });
  res.json(activeSwaps);
});

export const revertFloorSwap = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { productId, activePairId, spotIndex } = req.body;
  const revertedProductIds: string[] = [];

  if (productId) {
    const product = await Product.findById(productId);
    if (product) {
      const baseline = getBaselineCoordsForProduct(product);
      await Product.findByIdAndUpdate(productId, {
        $set: { coordinates3D: baseline },
      });
      revertedProductIds.push(String(productId));

      const floorRecord = await FloorSwap.findOne({
        status: "active",
        "executedItems.productId": productId,
      });

      if (floorRecord) {
        const itemIdx = floorRecord.executedItems.findIndex((it: any) => String(it.productId) === String(productId));
        if (itemIdx !== -1 && floorRecord.displacedItems && floorRecord.displacedItems[itemIdx]) {
          const dispItem = floorRecord.displacedItems[itemIdx];
          if (dispItem.productId) {
            const dProd = await Product.findById(dispItem.productId);
            if (dProd) {
              const dBaseline = getBaselineCoordsForProduct(dProd);
              await Product.findByIdAndUpdate(dispItem.productId, {
                $set: { coordinates3D: dBaseline },
              });
              revertedProductIds.push(String(dispItem.productId));
            }
          }
        }
        floorRecord.executedItems = floorRecord.executedItems.filter((it: any) => String(it.productId) !== String(productId));
        if (floorRecord.executedItems.length === 0) {
          floorRecord.status = "reverted";
          floorRecord.revertedAt = new Date();
        }
        await floorRecord.save();
      }
    }
  } else if (activePairId || typeof spotIndex === "number") {
    const query: any = { status: "active" };
    if (activePairId) query.activePairId = activePairId;
    if (typeof spotIndex === "number") query.spotIndex = spotIndex;

    const records = await FloorSwap.find(query);
    for (const rec of records) {
      for (const it of rec.executedItems) {
        const prod = await Product.findById(it.productId);
        if (prod) {
          const baseline = getBaselineCoordsForProduct(prod);
          await Product.findByIdAndUpdate(prod._id, {
            $set: { coordinates3D: baseline },
          });
        }
        revertedProductIds.push(String(it.productId));
      }
      for (const d of (rec.displacedItems || [])) {
        if (d.productId) {
          const dProd = await Product.findById(d.productId);
          if (dProd) {
            const dBaseline = getBaselineCoordsForProduct(dProd);
            await Product.findByIdAndUpdate(dProd._id, {
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

  const remainingActive = await FloorSwap.countDocuments({ status: "active" });
  if (remainingActive === 0) {
    await Planogram.updateMany({}, { applied: false });
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
    getIO().emit("floor_swap_reverted", payload);
    getIO().emit("product:updated");
  } catch (err) {
    console.error("Socket emit failed on revert:", err);
  }

  res.json({
    success: true,
    message: `Successfully reverted ${revertedProductIds.length} floor swap item(s)`,
    payload,
  });
});

export const resetAllShowroomSwaps = asyncHandler(async (req: AuthRequest, res: Response) => {
  const swapRes = await FloorSwap.updateMany(
    { status: "active" },
    { $set: { status: "reverted", revertedAt: new Date() } }
  );

  await resetAllProductsToBaselineCoords();
  await Planogram.updateMany({}, { $set: { applied: false } });

  try {
    getIO().emit("floor_swap_reverted", {
      all: true,
      allReset: true,
      staffName: req.user?.name || "Store Manager",
      timestamp: new Date().toISOString(),
    });
    getIO().emit("product:updated");
  } catch {}

  res.json({
    success: true,
    message: `Seasonal store reset complete: all ${swapRes.modifiedCount} active swaps reverted back to baseline home shelves.`,
  });
});
