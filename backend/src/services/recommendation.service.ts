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
 * Attribute-similarity score: same category + same color scores highest,
 * shared tags add partial credit. This is the deterministic core - it works
 * with zero external dependencies. Groq is used only to generate a
 * human-readable explanation/business insight on top of it (optional).
 */
const similarityScore = (a: IProduct, b: IProduct): number => {
  if (String(a._id) === String(b._id)) return -1;
  let score = 0;
  if (a.category === b.category) score += 3;
  if (a.color === b.color) score += 2;
  const sharedTags = a.tags.filter((t) => b.tags.includes(t)).length;
  score += sharedTags;
  return score;
};

export const getSimilarProducts = async (productId: string, limit = 5): Promise<IProduct[]> => {
  const source = await Product.findById(productId);
  if (!source) return [];
  const candidates = await Product.find({ _id: { $ne: source._id } });
  return candidates
    .map((c) => ({ product: c, score: similarityScore(source, c) }))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((c) => c.product);
};

export const buildRecommendationsForFastMovers = async (
  fastMovers: VelocityResult[],
  useAI: boolean
): Promise<Recommendation[]> => {
  const recs: Recommendation[] = [];
  for (const fm of fastMovers) {
    const similarProducts = await getSimilarProducts(String(fm.product._id), 5);
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
