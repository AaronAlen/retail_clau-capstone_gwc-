import { Response } from "express";
import asyncHandler from "express-async-handler";
import { AuthRequest } from "../types";
import { computeVelocity } from "../services/velocity.service";

export const getVelocity = asyncHandler(async (req: AuthRequest, res: Response) => {
  const windowDays = req.query.windowDays ? Number(req.query.windowDays) : 7;
  const results = await computeVelocity(windowDays);
  res.json(results);
});

export const getFastMovers = asyncHandler(async (req: AuthRequest, res: Response) => {
  const windowDays = req.query.windowDays ? Number(req.query.windowDays) : 7;
  const results = await computeVelocity(windowDays);
  res.json(results.filter((r) => r.isFastMover));
});

export const getDashboardSummary = asyncHandler(async (req: AuthRequest, res: Response) => {
  const results = await computeVelocity(7);
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
