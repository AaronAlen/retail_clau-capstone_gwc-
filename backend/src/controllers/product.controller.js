"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordSale = exports.deleteProduct = exports.updateProduct = exports.createProduct = exports.getProduct = exports.listProducts = void 0;
const express_async_handler_1 = __importDefault(require("express-async-handler"));
const Product_1 = __importDefault(require("../models/Product"));
const sockets_1 = require("../sockets");
exports.listProducts = (0, express_async_handler_1.default)(async (req, res) => {
    const { category, color, search } = req.query;
    const filter = {};
    if (category)
        filter.category = category;
    if (color)
        filter.color = color;
    if (search)
        filter.name = { $regex: String(search), $options: "i" };
    const products = await Product_1.default.find(filter).sort({ createdAt: -1 });
    res.json(products);
});
exports.getProduct = (0, express_async_handler_1.default)(async (req, res) => {
    const product = await Product_1.default.findById(req.params.id);
    if (!product) {
        res.status(404);
        throw new Error("Product not found");
    }
    res.json(product);
});
exports.createProduct = (0, express_async_handler_1.default)(async (req, res) => {
    const product = await Product_1.default.create(req.body);
    res.status(201).json(product);
});
exports.updateProduct = (0, express_async_handler_1.default)(async (req, res) => {
    const product = await Product_1.default.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true,
    });
    if (!product) {
        res.status(404);
        throw new Error("Product not found");
    }
    // live stock update pushed to all connected dashboards
    (0, sockets_1.getIO)().emit("product:updated", product);
    res.json(product);
});
exports.deleteProduct = (0, express_async_handler_1.default)(async (req, res) => {
    const product = await Product_1.default.findByIdAndDelete(req.params.id);
    if (!product) {
        res.status(404);
        throw new Error("Product not found");
    }
    res.json({ message: "Product deleted" });
});
exports.recordSale = (0, express_async_handler_1.default)(async (req, res) => {
    const { quantity } = req.body;
    const product = await Product_1.default.findById(req.params.id);
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
    const Sale = (await Promise.resolve().then(() => __importStar(require("../models/Sale")))).default;
    const sale = await Sale.create({ product: product._id, quantity: qty });
    (0, sockets_1.getIO)().emit("sale:new", { product, sale });
    res.status(201).json({ product, sale });
});
//# sourceMappingURL=product.controller.js.map