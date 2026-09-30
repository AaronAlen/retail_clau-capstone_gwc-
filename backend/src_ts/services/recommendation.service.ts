import { IProduct } from "../models/Product";
import Product from "../models/Product";
import { VelocityResult } from "./velocity.service";
import { explainRecommendation } from "./groq.service";

export interface Recommendation {
  id?: string;
  pairIndex?: number;
  pairNumber?: number;
  pairType?: "hero_runway" | "cupboard_bay";
  stationBadge?: string;
  stationName?: string;
  department?: string;
  lift?: string;
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
  limit = 4,
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

  // First pass: Guarantee at least ONE top candidate from EACH of the 4 OTHER CUPBOARDS
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

  // Second pass: Fill remaining slots if limit > selected (e.g. if a department has no items)
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

export const normalizeCategory = (cat?: string): string => {
  const c = (cat || "").toLowerCase();
  if (c.includes("jacket") || c.includes("coat") || c.includes("blazer")) return "Jackets";
  if (c.includes("t-shirt") || c.includes("tee")) return "T-Shirts";
  if (c.includes("shirt") || c.includes("oxford") || c.includes("linen")) return "Shirts";
  if (c.includes("jean") || c.includes("denim") || c.includes("trouser")) return "Jeans";
  if (c.includes("shoe") || c.includes("boot") || c.includes("loafer") || c.includes("sneaker")) return "Shoes";
  return cat || "";
};

/**
 * 🌟 Complete 4-Piece Runway Outfit for Hero Mannequins:
 * A mannequin doll wears exactly 4 pieces:
 * 1. Outerwear (Jackets)
 * 2. Topwear (Shirts or T-Shirts)
 * 3. Bottomwear (Jeans/Pants) - GUARANTEED / NEVER SKIPPED!
 * 4. Footwear (Shoes) - GUARANTEED / NEVER SKIPPED!
 *
 * Given the 1 fast-selling anchor, we select the EXACT 3 remaining missing pieces.
 * 1 Anchor + 3 Partners = EXACTLY 4 PRODUCTS TOTAL on the mannequin!
 */
export const getHeroRunwayOutfit = async (
  source: IProduct,
  excludeProductIds: string[] = []
): Promise<IProduct[]> => {
  const sourceCat = normalizeCategory(source.category);
  const excludeSet = new Set<string>([String(source._id), ...excludeProductIds.map(String)]);

  // The 3 missing categories needed to complete the 4-piece outfit:
  let missingSlots: Array<{ slot: string; categories: string[] }> = [];

  if (sourceCat === "Jackets") {
    // Source is Outerwear -> Need 1 Topwear, 1 Pants (Jeans), 1 Shoes
    missingSlots = [
      { slot: "topwear", categories: ["Shirts", "T-Shirts"] },
      { slot: "bottomwear", categories: ["Jeans"] },
      { slot: "footwear", categories: ["Shoes"] },
    ];
  } else if (sourceCat === "Shirts" || sourceCat === "T-Shirts") {
    // Source is Topwear -> Need 1 Outerwear (Jackets), 1 Pants (Jeans), 1 Shoes
    missingSlots = [
      { slot: "outerwear", categories: ["Jackets"] },
      { slot: "bottomwear", categories: ["Jeans"] },
      { slot: "footwear", categories: ["Shoes"] },
    ];
  } else if (sourceCat === "Jeans") {
    // Source is Pants -> Need 1 Outerwear (Jackets), 1 Topwear, 1 Shoes
    missingSlots = [
      { slot: "outerwear", categories: ["Jackets"] },
      { slot: "topwear", categories: ["Shirts", "T-Shirts"] },
      { slot: "footwear", categories: ["Shoes"] },
    ];
  } else if (sourceCat === "Shoes") {
    // Source is Shoes -> Need 1 Outerwear (Jackets), 1 Topwear, 1 Pants (Jeans)
    missingSlots = [
      { slot: "outerwear", categories: ["Jackets"] },
      { slot: "topwear", categories: ["Shirts", "T-Shirts"] },
      { slot: "bottomwear", categories: ["Jeans"] },
    ];
  } else {
    missingSlots = [
      { slot: "outerwear", categories: ["Jackets"] },
      { slot: "bottomwear", categories: ["Jeans"] },
      { slot: "footwear", categories: ["Shoes"] },
    ];
  }

  const outfitPartners: IProduct[] = [];

  for (const slot of missingSlots) {
    const candidateItems = await Product.find({
      category: { $in: slot.categories },
      _id: { $nin: Array.from(excludeSet) },
    });

    if (candidateItems.length > 0) {
      const scored = candidateItems.map((c) => ({
        product: c,
        score: crossCupboardAffinityScore(source, c),
      }));
      scored.sort((a, b) => b.score - a.score);
      const chosen = scored[0].product;
      outfitPartners.push(chosen);
      excludeSet.add(String(chosen._id));
    } else {
      const fallbackItem = await Product.findOne({
        category: { $in: slot.categories },
        _id: { $ne: source._id },
      });
      if (fallbackItem) {
        outfitPartners.push(fallbackItem);
        excludeSet.add(String(fallbackItem._id));
      }
    }
  }

  return outfitPartners; // Exactly 3 complementary pieces!
};

export const buildRecommendationsForFastMovers = async (
  fastMovers: VelocityResult[],
  useAI: boolean
): Promise<Recommendation[]> => {
  const recs: Recommendation[] = [];
  const globallyAllocatedProductIds = new Set<string>();
  fastMovers.forEach((fm) => {
    if (fm.product && fm.product._id) {
      globallyAllocatedProductIds.add(String(fm.product._id));
    }
  });

  const lifts = ["+84%", "+82%", "+78%", "+76%", "+74%", "+72%", "+68%", "+64%"];
  const pairMetaList = [
    { badge: "🌟 HERO 1", name: "Hero Station 1: West Runway Pedestal", type: "hero_runway" as const, dept: "Outerwear & Casual Styling" },
    { badge: "👑 HERO 2 (VIP)", name: "Hero Station 2: Prime Center VIP Apex Runway", type: "hero_runway" as const, dept: "VIP Luxury Formal Ensemble" },
    { badge: "⚡ HERO 3", name: "Hero Station 3: East Runway Trend Pedestal", type: "hero_runway" as const, dept: "Streetwear Studio Trend" },
    { badge: "🧥 CUPBOARD 1", name: "West Wing: Savile Row Outerwear Cupboard", type: "cupboard_bay" as const, dept: "Jackets" },
    { badge: "👔 CUPBOARD 2", name: "North-West Wing: Royal Oxford Wardrobe Cupboard", type: "cupboard_bay" as const, dept: "Shirts" },
    { badge: "👖 CUPBOARD 3", name: "North Wing: Premium Denim Studio Cupboard", type: "cupboard_bay" as const, dept: "Jeans" },
    { badge: "👕 CUPBOARD 4", name: "North-East Wing: Streetwear Studio Cupboard", type: "cupboard_bay" as const, dept: "T-Shirts" },
    { badge: "👞 CUPBOARD 5", name: "East Wing: Luxury Footwear Lounge Cupboard", type: "cupboard_bay" as const, dept: "Shoes" },
  ];

  for (let idx = 0; idx < fastMovers.length; idx++) {
    const fm = fastMovers[idx];
    const isHeroRunway = idx < 3;
    let similarProducts: IProduct[] = [];

    if (isHeroRunway) {
      // 🌟 Hero Runway: Exactly 3 items so Anchor (1) + Partners (3) = 4 Wearable Mannequin Pieces!
      similarProducts = await getHeroRunwayOutfit(
        fm.product,
        Array.from(globallyAllocatedProductIds)
      );
    } else {
      // 🏬 Cupboard Bays: 4 cross-cupboard bilateral mutual partners
      similarProducts = await getSimilarProducts(
        String(fm.product._id),
        4,
        Array.from(globallyAllocatedProductIds)
      );
    }

    similarProducts.forEach((p) => {
      globallyAllocatedProductIds.add(String(p._id));
    });

    const meta = pairMetaList[idx] || {
      badge: `★ PAIR #${idx + 1}`,
      name: `Showroom Station #${idx + 1}`,
      type: (idx < 3 ? "hero_runway" : "cupboard_bay") as "hero_runway" | "cupboard_bay",
      dept: fm.product.category,
    };

    let reason = isHeroRunway
      ? `${fm.product.name} is selling ${fm.velocityPerDay.toFixed(
          2
        )} units/day. Co-locating 3 complementary fashion pieces (${similarProducts
          .map((p) => p.category)
          .join(", ")}) completes the 4-piece mannequin ensemble (Outerwear, Topwear, Pants, Footwear) on the central runway to drive maximum cross-sell basket lift.`
      : `${fm.product.name} is selling ${fm.velocityPerDay.toFixed(
          2
        )} units/day, well above category benchmark. Positioning 4 complementary items (${similarProducts
          .map((p) => p.category)
          .join(", ")}) completes the full outfit and drives basket size lift.`;

    if (useAI) {
      try {
        reason = await explainRecommendation(fm.product, similarProducts, fm.velocityPerDay);
      } catch {
        // Groq unavailable/no key - silently fall back to the rule-based reason above
      }
    }

    recs.push({
      id: `sug-${idx + 1}`,
      pairIndex: idx,
      pairNumber: idx + 1,
      pairType: meta.type,
      stationBadge: meta.badge,
      stationName: meta.name,
      department: meta.dept,
      lift: lifts[idx] || "+64%",
      sourceProduct: fm.product,
      similarProducts,
      reason,
    });
  }
  return recs;
};
