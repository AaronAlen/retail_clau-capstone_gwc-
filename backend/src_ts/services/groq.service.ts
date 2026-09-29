import { IProduct } from "../models/Product";

/**
 * Thin wrapper around Groq's OpenAI-compatible chat completions endpoint.
 * If GROQ_API_KEY is not set, callers should catch the error and fall back
 * to the deterministic, rule-based explanation - the app must never depend
 * on this being configured to function.
 */
export const explainRecommendation = async (
  source: IProduct,
  similar: IProduct[],
  velocityPerDay: number
): Promise<string> => {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || apiKey === "your_groq_api_key_here") {
    throw new Error("GROQ_API_KEY not configured");
  }

  const model = process.env.GROQ_MODEL || "qwen/qwen3.8-27b";
  const prompt = `You are a retail merchandising analyst. A product called "${source.name}" (category: ${source.category}, color: ${source.color}) is selling at ${velocityPerDay.toFixed(
    2
  )} units/day, faster than similar items. Similar in-stock products to cross-merchandise nearby: ${similar
    .map((p) => p.name)
    .join(", ") || "none found"}. In 2-3 sentences, explain WHY placing these nearby could lift sales, in plain business language for a store manager.`;

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
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

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return data.choices?.[0]?.message?.content?.trim() || "AI explanation unavailable.";
};
