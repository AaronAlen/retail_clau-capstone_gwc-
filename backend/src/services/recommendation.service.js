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
const getSimilarProducts = async (productId, limit = 5) => {
    const source = await Product_1.default.findById(productId);
    if (!source)
        return [];
    // All 5 store departments
    const storeDepartments = ["Jackets", "Shirts", "Jeans", "T-Shirts", "Shoes"];
    const otherDepartments = storeDepartments.filter((c) => c.toLowerCase() !== (source.category || "").toLowerCase());
    const selectedPairs = [];
    // First pass: Guarantee at least ONE top candidate from EACH DIFFERENT CUPBOARD
    for (const dept of otherDepartments) {
        const deptItems = await Product_1.default.find({ category: dept });
        if (deptItems.length > 0) {
            const scored = deptItems.map((c) => ({
                product: c,
                score: crossCupboardAffinityScore(source, c),
            }));
            scored.sort((a, b) => b.score - a.score);
            if (scored[0]) {
                selectedPairs.push(scored[0].product);
            }
        }
    }
    // Second pass: Fill remaining slots if limit > selected (e.g. limit is 5)
    if (selectedPairs.length < limit) {
        const existingIds = [source._id, ...selectedPairs.map((p) => p._id)];
        const additional = await Product_1.default.find({
            category: { $ne: source.category },
            _id: { $nin: existingIds },
        }).limit(limit - selectedPairs.length);
        selectedPairs.push(...additional);
    }
    return selectedPairs.slice(0, limit);
};
exports.getSimilarProducts = getSimilarProducts;
const buildRecommendationsForFastMovers = async (fastMovers, useAI) => {
    const recs = [];
    for (const fm of fastMovers) {
        const similarProducts = await (0, exports.getSimilarProducts)(String(fm.product._id), 5);
        let reason = `${fm.product.name} is selling ${fm.velocityPerDay.toFixed(2)} units/day, well above its category average. Placing visually similar ${fm.product.color.toLowerCase()} ${fm.product.category.toLowerCase()} nearby can capture the same demand.`;
        if (useAI) {
            try {
                reason = await (0, groq_service_1.explainRecommendation)(fm.product, similarProducts, fm.velocityPerDay);
            }
            catch {
                // Groq unavailable/no key - silently fall back to the rule-based reason above
            }
        }
        recs.push({ sourceProduct: fm.product, similarProducts, reason });
    }
    return recs;
};
exports.buildRecommendationsForFastMovers = buildRecommendationsForFastMovers;
//# sourceMappingURL=recommendation.service.js.map