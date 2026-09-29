"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeVelocity = void 0;
const Sale_1 = __importDefault(require("../models/Sale"));
const Product_1 = __importDefault(require("../models/Product"));
/**
 * Computes sales velocity (units/day) for every product over a rolling window,
 * flags "fast movers" using a z-score-ish threshold relative to the category average
 * so the label adapts to the store's own catalog instead of a hardcoded number.
 */
const computeVelocity = async (windowDays = 7) => {
    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
    const agg = await Sale_1.default.aggregate([
        { $match: { soldAt: { $gte: since } } },
        { $group: { _id: "$product", unitsSoldWindow: { $sum: "$quantity" } } },
    ]);
    const salesMap = new Map();
    agg.forEach((row) => salesMap.set(String(row._id), row.unitsSoldWindow));
    const products = await Product_1.default.find();
    const results = products.map((product) => {
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
    const byCategory = new Map();
    results.forEach((r) => {
        const key = r.product.category;
        if (!byCategory.has(key))
            byCategory.set(key, []);
        byCategory.get(key).push(r);
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
exports.computeVelocity = computeVelocity;
//# sourceMappingURL=velocity.service.js.map