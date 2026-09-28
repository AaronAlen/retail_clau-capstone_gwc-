import Sale from "../models/Sale";
import Product, { IProduct } from "../models/Product";

export interface VelocityResult {
  product: IProduct;
  unitsSoldWindow: number;
  velocityPerDay: number;
  stock: number;
  daysOfStockLeft: number | null;
  isFastMover: boolean;
}

/**
 * Computes sales velocity (units/day) for every product over a rolling window,
 * flags "fast movers" using a z-score-ish threshold relative to the category average
 * so the label adapts to the store's own catalog instead of a hardcoded number.
 */
export const computeVelocity = async (windowDays = 7): Promise<VelocityResult[]> => {
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

  const agg = await Sale.aggregate([
    { $match: { soldAt: { $gte: since } } },
    { $group: { _id: "$product", unitsSoldWindow: { $sum: "$quantity" } } },
  ]);

  const salesMap = new Map<string, number>();
  agg.forEach((row) => salesMap.set(String(row._id), row.unitsSoldWindow));

  const products = await Product.find();

  const results: VelocityResult[] = products.map((product) => {
    const unitsSoldWindow = salesMap.get(String(product._id)) || 0;
    const velocityPerDay = unitsSoldWindow / windowDays;
    const daysOfStockLeft = velocityPerDay > 0 ? Math.round(product.stock / velocityPerDay) : null;
    return {
      product,
      unitsSoldWindow,
      velocityPerDay,
      stock: product.stock,
      daysOfStockLeft,
      isFastMover: false,
    };
  });

  // Category-relative threshold: fast mover if velocity > mean + 0.75*stddev of its own category
  const byCategory = new Map<string, VelocityResult[]>();
  results.forEach((r) => {
    const key = r.product.category;
    if (!byCategory.has(key)) byCategory.set(key, []);
    byCategory.get(key)!.push(r);
  });

  byCategory.forEach((rows) => {
    const values = rows.map((r) => r.velocityPerDay);
    const mean = values.reduce((a, b) => a + b, 0) / (values.length || 1);
    const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / (values.length || 1);
    const stddev = Math.sqrt(variance);
    const threshold = mean + 0.75 * stddev;
    rows.forEach((r) => {
      r.isFastMover = r.velocityPerDay > 0 && r.velocityPerDay >= Math.max(threshold, 0.3);
    });
  });

  return results.sort((a, b) => b.velocityPerDay - a.velocityPerDay);
};
