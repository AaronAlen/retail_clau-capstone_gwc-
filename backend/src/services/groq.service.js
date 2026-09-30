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
    const isHeroRunway = similar.length === 3;
    const prompt = `You are an expert luxury retail visual merchandising analyst.
A top fast-selling anchor product "${source.name}" (category: ${source.category}, color: ${source.color}) is selling at ${velocityPerDay.toFixed(2)} units/day.
${
  isHeroRunway
    ? `For the premier Hero Runway Mannequin, exactly 3 complementary in-stock products are paired with "${source.name}" to form a complete 4-piece coordinated outfit:
${similar.map((p, i) => `${i + 1}. ${p.name} (${p.category}, color: ${p.color})`).join("\n")}.
Together with "${source.name}", these 4 wearable products completely dress the mannequin across all 4 zones: Outerwear, Topwear, Pants/Bottomwear, and Footwear/Shoes (never omitting pants or shoes).`
    : `For the In-Aisle Cupboard Bay, 4 complementary in-stock products are paired with "${source.name}" across other cupboards:
${similar.map((p, i) => `${i + 1}. ${p.name} (${p.category}, color: ${p.color})`).join("\n")}.
These products form 1-to-1 bilateral mutual swaps with the other showroom cupboards (Jackets, Shirts, Jeans, T-Shirts, Shoes), preventing duplicate fixture clutter.`
}

In 2 concise, impactful sentences, explain WHY dressing this complete coordinated arrangement with "${source.name}" drives immediate cross-department basket conversions for the store manager.`;
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