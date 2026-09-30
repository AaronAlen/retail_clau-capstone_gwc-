import { Response } from "express";
import asyncHandler from "express-async-handler";
import { AuthRequest } from "../types";
import { computeVelocity } from "../services/velocity.service";
import { buildRecommendationsForFastMovers, getSimilarProducts } from "../services/recommendation.service";
import Planogram from "../models/Planogram";
import Product from "../models/Product";
import { getIO } from "../sockets";

export const getRecommendations = asyncHandler(async (req: AuthRequest, res: Response) => {
  const useAI = req.query.ai === "true";
  const results = await computeVelocity(7);

  // 🌟 Balance fast-movers across all 5 store departments (Jackets, Shirts, Jeans, T-Shirts, Shoes)
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
  const fastMovers = results.filter((r) => r.isFastMover);
  const fastMoversByDept = new Map<string, typeof results>();
  storeDepartments.forEach((d) => fastMoversByDept.set(d, []));
  fastMovers.forEach((fm) => {
    const norm = normalizeCategory(fm.product?.category);
    if (fastMoversByDept.has(norm)) fastMoversByDept.get(norm)!.push(fm);
  });

  // Round 1: Top fast mover from each distinct department/cupboard
  const balancedFastMovers: typeof results = [];
  storeDepartments.forEach((dept) => {
    const items = fastMoversByDept.get(dept) || [];
    if (items.length > 0) {
      balancedFastMovers.push(items[0]);
    } else {
      const deptResults = results.filter((r) => normalizeCategory(r.product?.category) === dept);
      deptResults.sort((a, b) => b.velocityPerDay - a.velocityPerDay);
      if (deptResults[0]) balancedFastMovers.push(deptResults[0]);
    }
  });

  // Round 2: Add any remaining fast movers up to 10
  const addedIds = new Set(balancedFastMovers.map((b) => String(b.product._id)));
  fastMovers.forEach((fm) => {
    if (!addedIds.has(String(fm.product._id)) && balancedFastMovers.length < 10) {
      balancedFastMovers.push(fm);
      addedIds.add(String(fm.product._id));
    }
  });

  const recommendations = await buildRecommendationsForFastMovers(balancedFastMovers, useAI);
  res.json(recommendations);
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
