import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { GroupScoringInput, Recommendation } from "@/types";
import { AiEnrichmentSchema, type AiEnrichment } from "./schema";
import { buildFallbackEnrichment } from "./fallback";
import { SYSTEM_PROMPT, buildUserPrompt } from "./prompt";

export interface EnrichmentResult {
  enrichment: AiEnrichment;
  source: "ai" | "fallback";
}

/**
 * Called exactly once, server-side, at the collecting → voting transition.
 * ANTHROPIC_API_KEY never leaves the server; the client only ever sends
 * { sessionId }. Any failure — missing key, timeout, malformed output —
 * falls back to deterministic copy that renders identically in the UI.
 */
export async function enrichRecommendations(
  recs: Pick<Recommendation, "restaurant_id" | "restaurant_name" | "score_breakdown">[],
  group: GroupScoringInput
): Promise<EnrichmentResult> {
  const fallback = () => ({
    enrichment: buildFallbackEnrichment(recs, group),
    source: "fallback" as const,
  });

  if (process.env.AI_DISABLED === "1" || !process.env.ANTHROPIC_API_KEY) {
    return fallback();
  }

  try {
    const client = new Anthropic({ timeout: 25_000, maxRetries: 1 });
    const response = await client.messages.parse({
      model: "claude-opus-4-8",
      max_tokens: 4096, // deliberately small output: 3 short blurbs + one observation
      system: SYSTEM_PROMPT,
      output_config: {
        effort: "low", // copywriting, latency-sensitive (runs on a live demo click)
        format: zodOutputFormat(AiEnrichmentSchema),
      },
      messages: [{ role: "user", content: buildUserPrompt(recs, group) }],
    });

    const parsed = response.parsed_output;
    if (!parsed) return fallback();

    // The AI must cover exactly our three restaurant ids — anything else is malformed.
    const expected = new Set(recs.map((r) => r.restaurant_id));
    const returned = new Set(parsed.restaurants.map((r) => r.restaurant_id));
    if (expected.size !== returned.size || ![...expected].every((id) => returned.has(id))) {
      return fallback();
    }

    return { enrichment: parsed, source: "ai" };
  } catch {
    // Never let the scariest live-demo dependency break the transition.
    return fallback();
  }
}
