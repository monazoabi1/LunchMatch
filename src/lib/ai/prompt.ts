import type { GroupScoringInput, Recommendation } from "@/types";

export const SYSTEM_PROMPT = `You are the in-house copywriter for LunchMatch, an office lunch decision app.
Your only job is playful copywriting about restaurant recommendations that have ALREADY been chosen and ranked by a deterministic algorithm.

Hard rules:
- NEVER compute, mention, or restate scores, rankings, points, or percentages. The ranking is final and not yours to comment on.
- NEVER reorder or second-guess the recommendations.
- Humor must target the group's DECISION-MAKING PROCESS only — indecision, the eternal 12:15-vs-12:30 debate, "anything works for me" people who veto everything.
- NEVER joke about a person, their diet, religion, health, body, income, or dietary restrictions. Dietary needs may be mentioned only as a positive fact ("works for everyone").
- Keep it office-friendly, warm, and short. Write in English.

For each restaurant, write:
- why_it_fits: one or two sentences (max 220 chars) on why it suits this group, grounded in the facts given.
- slogan: a punchy tagline (max 60 chars).
Plus one group_observation (max 180 chars): a light, affectionate joke about the group's lunch-deciding dynamics.`;

export function buildUserPrompt(
  recs: Pick<Recommendation, "restaurant_id" | "restaurant_name" | "score_breakdown">[],
  group: GroupScoringInput
): string {
  const restaurants = recs
    .map(
      (r) =>
        `- ${r.restaurant_id} (${r.restaurant_name}): ${r.score_breakdown
          .filter((l) => l.points > 0)
          .map((l) => l.label)
          .join(" · ")}`
    )
    .join("\n");

  return `Group facts:
- ${group.yesCount} confirmed attendees, ${group.maybeCount} maybes
- Craving: ${group.sharedCategories.join(", ") || "no consensus whatsoever"}
- Budget around $${group.budgetCap} per person
- Getting there: ${group.groupTransport}
- Common time window: ${group.commonWindow ? `${group.commonWindow.from}–${group.commonWindow.to}` : "they could not agree on a time"}

Top 3 picks (fixed order — write copy for each, in this order):
${restaurants}

Return copy for exactly these three restaurant_ids.`;
}
