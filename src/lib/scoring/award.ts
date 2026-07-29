import type { LunchPreference, Restaurant, Uuid } from "@/types";
import { hhmmToMinutes } from "./aggregate";

export interface DifficultCoworkerAward {
  user_id: Uuid;
  reason: string;
  matchCount: number;
}

// Fixed, harmless phrases — one per constraint. Dietary is deliberately NOT
// here: an award computed on allergy/religion/health data is the
// "insulting/discriminatory" outcome the spec forbids.
const REASONS: Record<string, string> = {
  budget: "held the line on the budget",
  walk: "keeps the walks short and the standards high",
  time: "runs a tight calendar",
  category: "knows exactly what they want",
};

type Constraint = keyof typeof REASONS;

/**
 * Count how many restaurants satisfy ONE person's own constraints —
 * deliberately excluding their dietary restrictions from the count.
 * Lowest count wins the award. Returns null with < 2 attendees.
 */
export function computeAward(
  prefs: LunchPreference[],
  restaurants: Restaurant[]
): DifficultCoworkerAward | null {
  const attendees = prefs.filter((p) => p.attendance !== "no");
  if (attendees.length < 2) return null;

  const results = attendees.map((p) => {
    let matchCount = 0;
    const eliminatedBy: Record<Constraint, number> = { budget: 0, walk: 0, time: 0, category: 0 };

    for (const r of restaurants) {
      const fails: Constraint[] = [];
      if (r.avgPrice > Number(p.max_budget)) fails.push("budget");
      if (p.transport === "walk" && r.walkMinutes > p.max_walking_minutes) fails.push("walk");
      if (p.transport === "delivery" && !r.supportsDelivery) fails.push("walk");
      const from = hhmmToMinutes(p.available_from.slice(0, 5));
      const to = hhmmToMinutes(p.available_to.slice(0, 5));
      if (!(hhmmToMinutes(r.opensAt) < to && hhmmToMinutes(r.closesAt) > from)) fails.push("time");
      if (p.categories.length > 0 && !r.categories.some((c) => p.categories.includes(c))) {
        fails.push("category");
      }

      if (fails.length === 0) matchCount++;
      else for (const f of fails) eliminatedBy[f]++;
    }

    // The single constraint that eliminated the most restaurants → the reason.
    const topConstraint = (Object.entries(eliminatedBy) as [Constraint, number][]).sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0])
    )[0];

    return { user_id: p.user_id, matchCount, reason: REASONS[topConstraint[0]] };
  });

  // Deterministic: lowest match count wins, tie-break by user_id.
  results.sort((a, b) => a.matchCount - b.matchCount || a.user_id.localeCompare(b.user_id));
  return results[0];
}
