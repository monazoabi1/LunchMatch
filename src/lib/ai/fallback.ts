import type { GroupScoringInput, Recommendation } from "@/types";
import type { AiEnrichment } from "./schema";

// Deterministic fallback — built day one, forced with AI_DISABLED=1.
// Renders identically to real AI copy; the demo survives an API outage invisibly.

const SLOGANS = [
  "Democracy, but delicious.",
  "The algorithm has spoken.",
  "Consensus never tasted this good.",
  "Lunch, solved.",
  "Verified by very serious math.",
  "Your stomach's new favorite spreadsheet.",
  "Peer-reviewed and taste-tested.",
  "The people's choice (pending vote).",
];

const OBSERVATIONS = [
  "This group spent longer picking a time window than most nations spend picking a government.",
  'Three people said "anything works" and then submitted nine preferences. Classic.',
  "The 12:15-vs-12:30 debate has been tabled until tomorrow. Again.",
  "Statistically, someone will still say 'I'm easy' and then veto the winner.",
  "A rare moment of alignment. Frame this.",
];

// Stable string hash so the same session always renders the same copy.
function stableHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function buildFallbackEnrichment(
  recs: Pick<Recommendation, "restaurant_id" | "restaurant_name" | "score_breakdown">[],
  group: GroupScoringInput
): AiEnrichment {
  return {
    restaurants: recs.map((r) => {
      const positives = r.score_breakdown.filter((l) => l.points > 0).map((l) => l.label);
      return {
        restaurant_id: r.restaurant_id,
        // e.g. "Works for everyone's dietary needs · The group asked for sushi · 6 min walk"
        why_it_fits: (positives.join(" · ") || "A solid, dependable choice").slice(0, 220),
        slogan: SLOGANS[stableHash(r.restaurant_id) % SLOGANS.length],
      };
    }),
    group_observation:
      OBSERVATIONS[
        stableHash(recs.map((r) => r.restaurant_id).join("|") + group.yesCount) %
          OBSERVATIONS.length
      ],
  };
}
