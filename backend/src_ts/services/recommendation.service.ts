import { IProduct } from "../models/Product";
import Product from "../models/Product";
import { VelocityResult } from "./velocity.service";
import { explainRecommendation } from "./groq.service";

export interface Recommendation {
  sourceProduct: IProduct;
  similarProducts: IProduct[];
  reason: string;
}

/**
 * Cross-cupboard attribute-pairing score:
 * Products from DIFFERENT departments (Jackets + Jeans + Shirts + T-Shirts + Shoes)
 * score highest to construct complete full-outfit cross-sell synergies across the store.
 */
const crossCupboardAffinityScore = (source: IProduct, candidate: IProduct): number => {
  if (String(source._id) === String(candidate._id)) return -1;
  let score = 0;

  // 1. Cross-Department Priority: Must be from a DIFFERENT cupboard to span showroom
  if (source.category !== candidate.category) {
    score += 8; // Heavy priority to ensure suggestions originate from distinct cupboards
  } else {
    score += 1;
  }

  // 2. Color Harmony
  if (source.color === candidate.color) {
    score += 4; // Monochromatic affinity
  }
  const neutrals = ["black", "white", "navy", "beige", "charcoal", "olive"];
  const isCandidateNeutral = neutrals.includes((candidate.color || "").toLowerCase());
  const isSourceNeutral = neutrals.includes((source.color || "").toLowerCase());
  if (isCandidateNeutral && isSourceNeutral) {
    score += 3;
  }

  // 3. Shared luxury styling tags
  const sharedTags = (source.tags || []).filter((t) => (candidate.tags || []).includes(t)).length;
  score += sharedTags * 2;

  return score;
};

export const getSimilarProducts = async (
  productId: string,
  limit = 5,
  excludeProductIds: string[] = []
): Promise<IProduct[]> => {
  const source = await Product.findById(productId);
  if (!source) return [];

  // All 5 store departments
  const storeDepartments = ["Jackets", "Shirts", "Jeans", "T-Shirts", "Shoes"];
  const otherDepartments = storeDepartments.filter((c) => c.toLowerCase() !== (source.category || "").toLowerCase());

  // Set of IDs to exclude: source product + any externally passed excluded IDs (already allocated to other fast movers)
  const excludeSet = new Set<string>([String(source._id), ...excludeProductIds.map(String)]);
  const selectedPairs: IProduct[] = [];

  // First pass: Guarantee at least ONE top candidate from EACH DIFFERENT CUPBOARD
  for (const dept of otherDepartments) {
    const deptItems = await Product.find({
      category: dept,
      _id: { $nin: Array.from(excludeSet) },
    });
    if (deptItems.length > 0) {
      const scored = deptItems.map((c) => ({
        product: c,
        score: crossCupboardAffinityScore(source, c),
      }));
      scored.sort((a, b) => b.score - a.score);
      if (scored[0]) {
        selectedPairs.push(scored[0].product);
        excludeSet.add(String(scored[0].product._id));
      }
    }
  }

  // Second pass: Fill remaining slots if limit > selected (e.g. limit is 5)
  if (selectedPairs.length < limit) {
    const additional = await Product.find({
      category: { $ne: source.category },
      _id: { $nin: Array.from(excludeSet) },
    }).limit(limit - selectedPairs.length);
    for (const p of additional) {
      selectedPairs.push(p);
      excludeSet.add(String(p._id));
    }
  }

  return selectedPairs.slice(0, limit);
};

export const buildRecommendationsForFastMovers = async (
  fastMovers: VelocityResult[],
  useAI: boolean
): Promise<Recommendation[]> => {
  const recs: Recommendation[] = [];
  // Prevent duplicate cross-merchandising suggestions across different fast movers:
  // A product allocated next to Fast Mover A cannot also be allocated next to Fast Mover B,
  // avoiding physical circular swap loops.
  const globallyAllocatedProductIds = new Set<string>();
  fastMovers.forEach((fm) => {
    if (fm.product && fm.product._id) {
      globallyAllocatedProductIds.add(String(fm.product._id));
    }
  });

  for (const fm of fastMovers) {
    const similarProducts = await getSimilarProducts(
      String(fm.product._id),
      5,
      Array.from(globallyAllocatedProductIds)
    );
    // Reserve these products globally so subsequent fast movers do not duplicate them
    similarProducts.forEach((p) => {
      globallyAllocatedProductIds.add(String(p._id));
    });

    let reason = `${fm.product.name} is selling ${fm.velocityPerDay.toFixed(
      2
    )} units/day, well above its category average. Placing visually similar ${fm.product.color.toLowerCase()} ${fm.product.category.toLowerCase()} nearby can capture the same demand.`;

    if (useAI) {
      try {
        reason = await explainRecommendation(fm.product, similarProducts, fm.velocityPerDay);
      } catch {
        // Groq unavailable/no key - silently fall back to the rule-based reason above
      }
    }

    recs.push({ sourceProduct: fm.product, similarProducts, reason });
  }
  return recs;
};
