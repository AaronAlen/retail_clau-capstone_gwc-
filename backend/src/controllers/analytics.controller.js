"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDashboardSummary = exports.getFastMovers = exports.getVelocity = void 0;
const express_async_handler_1 = __importDefault(require("express-async-handler"));
const velocity_service_1 = require("../services/velocity.service");
exports.getVelocity = (0, express_async_handler_1.default)(async (req, res) => {
    const windowDays = req.query.windowDays ? Number(req.query.windowDays) : 7;
    const results = await (0, velocity_service_1.computeVelocity)(windowDays);
    res.json(results);
});
exports.getFastMovers = (0, express_async_handler_1.default)(async (req, res) => {
    const windowDays = req.query.windowDays ? Number(req.query.windowDays) : 7;
    const results = await (0, velocity_service_1.computeVelocity)(windowDays);
    res.json(results.filter((r) => r.isFastMover));
});
exports.getDashboardSummary = (0, express_async_handler_1.default)(async (req, res) => {
    const results = await (0, velocity_service_1.computeVelocity)(7);
    const fastMovers = results.filter((r) => r.isFastMover);
    const totalUnitsSold = results.reduce((sum, r) => sum + r.unitsSoldWindow, 0);
    const lowStock = results.filter((r) => r.daysOfStockLeft !== null && r.daysOfStockLeft <= 3);
    res.json({
        totalProducts: results.length,
        totalUnitsSold7d: totalUnitsSold,
        fastMoverCount: fastMovers.length,
        fastMovers: fastMovers.slice(0, 6),
        lowStockAlerts: lowStock.slice(0, 6),
    });
});
//# sourceMappingURL=analytics.controller.js.map