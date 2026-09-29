"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatWithCopilot = void 0;
const express_async_handler_1 = __importDefault(require("express-async-handler"));
const Product_1 = __importDefault(require("../models/Product"));
const velocity_service_1 = require("../services/velocity.service");
exports.chatWithCopilot = (0, express_async_handler_1.default)(async (req, res) => {
    const { message, history } = req.body;
    if (!message) {
        res.status(400);
        throw new Error("Message is required");
    }
    // Gather live retail context
    const [products, velocityResults] = await Promise.all([
        Product_1.default.find({}),
        (0, velocity_service_1.computeVelocity)(7),
    ]);
    const fastMovers = velocityResults
        .filter((r) => r.isFastMover)
        .map((r) => `${r.product.name} (${r.product.category}, ${r.product.color}): velocity ${r.velocityPerDay.toFixed(1)} units/day, stock left: ${r.stock}`)
        .slice(0, 8);
    const lowStock = products
        .filter((p) => p.stock <= 5)
        .map((p) => `${p.name} (stock: ${p.stock})`)
        .slice(0, 8);
    const totalStock = products.reduce((acc, p) => acc + p.stock, 0);
    const categories = Array.from(new Set(products.map((p) => p.category)));
    // Detailed live catalog inventory for all products
    const inventoryList = products
        .map((p) => {
        const v = velocityResults.find((vr) => vr.product._id.toString() === p._id.toString());
        const rate = v ? `${v.velocityPerDay.toFixed(1)}/day` : "0.0/day";
        const badge = v?.isFastMover ? " [FAST-MOVER]" : p.stock <= 5 ? " [LOW-STOCK]" : "";
        return `- ${p.name} | Cat: ${p.category} | Color: ${p.color} | Price: $${p.price} | Stock: ${p.stock} units | Velocity: ${rate}${badge}`;
    })
        .join("\n");
    const systemContext = `You are the Velocity Retail AI Copilot, an elite retail strategist, visual merchandising director, and inventory analyst for a modern apparel boutique.

LIVE STORE DATABASE CONTEXT:
- Total Products in Catalog: ${products.length} across categories: ${categories.join(", ")}
- Total Units in Stock: ${totalStock}
- Fast-Moving Products:
  ${fastMovers.length ? fastMovers.join("\n  ") : "None currently detected"}
- Low-Stock Alerts (<= 5 units):
  ${lowStock.length ? lowStock.join("\n  ") : "All products adequately stocked"}

COMPLETE PRODUCT INVENTORY (Live MongoDB):
${inventoryList}

INSTRUCTIONS:
- Reference specific products using their exact names wrapped in bold asterisks, e.g. **Beige Jacket #3** or **Black Jean #12**, so the user's interface can render interactive action chips.
- Answer user queries accurately using the live inventory data (prices, stock, categories, velocity) above.
- Give concise, sharp, high-impact business advice (inventory replenishment, visual layout, discount strategy).
- Always format key recommendations starting with **Recommendation:** so the UI can highlight it as an action card.
- Keep responses friendly, structured, and easy to read.`;
    const apiKey = process.env.GROQ_API_KEY;
    const model = process.env.GROQ_MODEL || "qwen/qwen3.8-27b";
    if (!apiKey || apiKey === "your_groq_api_key_here") {
        res.status(503).json({
            reply: "⚠️ Groq API key is not configured in backend/.env. Please set GROQ_API_KEY to activate live AI reasoning.",
        });
        return;
    }
    try {
        const messages = [
            { role: "system", content: systemContext },
            ...(Array.isArray(history) ? history.slice(-6) : []),
            { role: "user", content: message },
        ];
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model,
                messages,
                max_tokens: 450,
                temperature: 0.5,
            }),
        });
        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Groq API ${response.status}: ${errText}`);
        }
        const data = (await response.json());
        const reply = data.choices?.[0]?.message?.content?.trim() || "No response received from Copilot.";
        res.json({ reply });
    }
    catch (err) {
        console.error("[copilot] Error:", err?.message);
        res.status(500).json({
            reply: `⚠️ AI Copilot Error: Failed to contact AI service (${err?.message || "Network error"}). Please check your connection or API key.`,
        });
    }
});
//# sourceMappingURL=copilot.controller.js.map