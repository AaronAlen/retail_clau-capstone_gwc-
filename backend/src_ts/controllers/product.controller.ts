import { Response } from "express";
import asyncHandler from "express-async-handler";
import Product from "../models/Product";
import { AuthRequest } from "../types";
import { getIO } from "../sockets";

export const listProducts = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { category, color, search } = req.query;
  const filter: Record<string, unknown> = {};
  if (category) filter.category = category;
  if (color) filter.color = color;
  if (search) filter.name = { $regex: String(search), $options: "i" };
  const products = await Product.find(filter).sort({ createdAt: -1 });
  res.json(products);
});

export const getProduct = asyncHandler(async (req: AuthRequest, res: Response) => {
  const product = await Product.findById(req.params.id);
  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }
  res.json(product);
});

export const createProduct = asyncHandler(async (req: AuthRequest, res: Response) => {
  const product = await Product.create(req.body);
  res.status(201).json(product);
});

export const updateProduct = asyncHandler(async (req: AuthRequest, res: Response) => {
  const product = await Product.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }
  // live stock update pushed to all connected dashboards
  getIO().emit("product:updated", product);
  res.json(product);
});

export const deleteProduct = asyncHandler(async (req: AuthRequest, res: Response) => {
  const product = await Product.findByIdAndDelete(req.params.id);
  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }
  res.json({ message: "Product deleted" });
});

export const recordSale = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { quantity } = req.body;
  const product = await Product.findById(req.params.id);
  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }
  const qty = Number(quantity) || 1;
  if (product.stock < qty) {
    res.status(400);
    throw new Error("Insufficient stock");
  }
  product.stock -= qty;
  await product.save();

  const Sale = (await import("../models/Sale")).default;
  const sale = await Sale.create({ product: product._id, quantity: qty });

  getIO().emit("sale:new", { product, sale });
  res.status(201).json({ product, sale });
});
