"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildRecommendationsForFastMovers = exports.getSimilarProducts = void 0;
const Product_1 = __importDefault(require("../models/Product"));
const groq_service_1 = require("./groq.service");
/**
 * Cross-cupboard attribute-pairing score:
 * Products from DIFFERENT departments (Jackets + Jeans + Shirts + T-Shirts + Shoes)
 * score highest to construct complete full-outfit cross-sell synergies across the store.
 */
const crossCupboardAffinityScore = (source, candidate) => {
    if (String(source._id) === String(candidate._id))
        return -1;
    let score = 0;
    // 1. Cross-Department Priority: Must be from a DIFFERENT cupboard to span showroom
    if (source.category !== candidate.category) {
        score += 8; // Heavy priority to ensure suggestions originate from distinct cupboards
    }
    else {
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
const getSimilarProducts = async (productId, limit = 4, excludeProductIds = []) => {
    const source = await Product_1.default.findById(productId);
    if (!source)
        return [];
    // All 5 store departments
    const storeDepartments = ["Jackets", "Shirts", "Jeans", "T-Shirts", "Shoes"];
    const otherDepartments = storeDepartments.filter((c) => c.toLowerCase() !== (source.category || "").toLowerCase());
    
    // Set of IDs to exclude: source product + any externally passed excluded IDs (already allocated to other fast movers)
    const excludeSet = new Set([String(source._id), ...excludeProductIds.map(String)]);
    const selectedPairs = [];
    
    // First pass: Guarantee at least ONE top candidate from EACH of the 4 OTHER CUPBOARDS
    for (const dept of otherDepartments) {
        const deptItems = await Product_1.default.find({ 
            category: dept,
            _id: { $nin: Array.from(excludeSet) }
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
    // Second pass: Fill remaining slots if limit > selected (e.g. if a department had no items)
    if (selectedPairs.length < limit) {
        const additional = await Product_1.default.find({
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
exports.getSimilarProducts = getSimilarProducts;
const buildRecommendationsForFastMovers = async (fastMovers, useAI) => {
    const recs = [];
    const globallyAllocatedProductIds = new Set();
    fastMovers.forEach((fm) => {
        if (fm.product && fm.product._id) {
            globallyAllocatedProductIds.add(String(fm.product._id));
        }
    });

    const lifts = ["+84%", "+82%", "+78%", "+76%", "+74%", "+72%", "+68%", "+64%"];
    const pairMetaList = [
        { badge: "🌟 HERO 1", name: "Hero Station 1: West Runway Pedestal", type: "hero_runway", dept: "Outerwear & Casual Styling" },
        { badge: "👑 HERO 2 (VIP)", name: "Hero Station 2: Prime Center VIP Apex Runway", type: "hero_runway", dept: "VIP Luxury Formal Ensemble" },
        { badge: "⚡ HERO 3", name: "Hero Station 3: East Runway Trend Pedestal", type: "hero_runway", dept: "Streetwear Studio Trend" },
        { badge: "🧥 CUPBOARD 1", name: "West Wing: Savile Row Outerwear Cupboard", type: "cupboard_bay", dept: "Jackets" },
        { badge: "👔 CUPBOARD 2", name: "North-West Wing: Royal Oxford Wardrobe Cupboard", type: "cupboard_bay", dept: "Shirts" },
        { badge: "👖 CUPBOARD 3", name: "North Wing: Premium Denim Studio Cupboard", type: "cupboard_bay", dept: "Jeans" },
        { badge: "👕 CUPBOARD 4", name: "North-East Wing: Streetwear Studio Cupboard", type: "cupboard_bay", dept: "T-Shirts" },
        { badge: "👞 CUPBOARD 5", name: "East Wing: Luxury Footwear Lounge Cupboard", type: "cupboard_bay", dept: "Shoes" },
    ];

    for (let idx = 0; idx < fastMovers.length; idx++) {
        const fm = fastMovers[idx];
        const similarProducts = await (0, exports.getSimilarProducts)(
            String(fm.product._id), 
            4, 
            Array.from(globallyAllocatedProductIds)
        );
        similarProducts.forEach((p) => {
            globallyAllocatedProductIds.add(String(p._id));
        });

        const meta = pairMetaList[idx] || {
            badge: `★ PAIR #${idx + 1}`,
            name: `Showroom Station #${idx + 1}`,
            type: (idx < 3 ? "hero_runway" : "cupboard_bay"),
            dept: fm.product.category,
        };

        let reason = `${fm.product.name} is selling ${fm.velocityPerDay.toFixed(2)} units/day, well above category benchmark. Positioning 4 complementary items (${similarProducts.map((p) => p.category).join(", ")}) completes the full outfit and drives basket size lift.`;
        if (useAI) {
            try {
                reason = await (0, groq_service_1.explainRecommendation)(fm.product, similarProducts, fm.velocityPerDay);
            }
            catch {
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
exports.buildRecommendationsForFastMovers = buildRecommendationsForFastMovers;
//# sourceMappingURL=recommendation.service.js.map