"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.explainRecommendation = void 0;
/**
 * Thin wrapper around Groq's OpenAI-compatible chat completions endpoint.
 * If GROQ_API_KEY is not set, callers should catch the error and fall back
 * to the deterministic, rule-based explanation - the app must never depend
 * on this being configured to function.
 */
const explainRecommendation = async (source, similar, velocityPerDay) => {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey || apiKey === "your_groq_api_key_here") {
        throw new Error("GROQ_API_KEY not configured");
    }
    const model = process.env.GROQ_MODEL || "qwen/qwen3.8-27b";
    const prompt = `You are an expert luxury retail visual merchandising analyst.
A top fast-selling anchor product "${source.name}" (category: ${source.category}, color: ${source.color}) is selling at ${velocityPerDay.toFixed(2)} units/day.
To maximize basket size and complete full-outfit cross-sell synergies across store departments, exactly 4 complementary in-stock products are paired:
${similar.map((p, i) => `${i + 1}. ${p.name} (${p.category}, color: ${p.color})`).join("\n") || "none found"}.

PHYSICAL MERCHANDISING ARCHITECTURE:
- For Hero Runway Mannequins: These 4 products complete a coordinated 4-piece fashion ensemble (Outerwear, Topwear, Bottomwear, Footwear) on the central runway.
- For In-Aisle Cupboard Bays: These 4 products form 1-to-1 bilateral mutual swaps with the other 4 showroom cupboards (Jackets, Shirts, Jeans, T-Shirts, Shoes), preventing duplicate fixture clutter.

In 2 concise, impactful sentences, explain WHY co-locating these exact 4 complementary partner items with "${source.name}" drives immediate cross-department basket conversions for the store manager.`;
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        signal: AbortSignal.timeout(3500),
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model,
            messages: [{ role: "user", content: prompt }],
            max_tokens: 200,
            temperature: 0.4,
        }),
    });
    if (!response.ok) {
        throw new Error(`Groq API error: ${response.status}`);
    }
    const data = (await response.json());
    return data.choices?.[0]?.message?.content?.trim() || "AI explanation unavailable.";
};
exports.explainRecommendation = explainRecommendation;
//# sourceMappingURL=groq.service.js.map