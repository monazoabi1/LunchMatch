import type { LunchPreference, Profile, Recommendation, Restaurant } from "@/types";
import { aggregatePreferences } from "./aggregate";
import { scoreRestaurant } from "./score";

export interface Squad {
  recommendation: Recommendation;
  members: Profile[];
}

export interface SquadResult {
  squads: Squad[];
  skipping: Profile[]; // attendance === 'no'
}

/**
 * Divide the workers into groups by the restaurant they're visiting.
 * Deterministic assignment rules, in order:
 *  1. Voted → you go where you swiped right.
 *  2. Didn't vote but submitted preferences → your best personal match among
 *     the top-3 (your solo prefs scored against each restaurant; tie → rank).
 *  3. No vote, no prefs → tag along with the rank-1 pick.
 *  Attendance 'no' → listed under `skipping`, not assigned to any squad.
 */
export function computeSquads(
  recs: Recommendation[],
  votes: { user_id: string; recommendation_id: string }[],
  members: Profile[],
  prefs: LunchPreference[],
  catalog: Restaurant[]
): SquadResult {
  const byId = new Map(recs.map((r) => [r.id, r]));
  const assigned = new Map<string, Profile[]>(recs.map((r) => [r.id, []]));
  const skipping: Profile[] = [];
  const rank1 = [...recs].sort((a, b) => a.rank - b.rank)[0];

  for (const member of members) {
    const pref = prefs.find((p) => p.user_id === member.id);
    if (pref?.attendance === "no") {
      skipping.push(member);
      continue;
    }

    const vote = votes.find((v) => v.user_id === member.id);
    let target = vote && byId.has(vote.recommendation_id) ? vote.recommendation_id : undefined;

    if (!target && pref) {
      const solo = aggregatePreferences([pref]);
      let best: { id: string; score: number; rank: number } | undefined;
      for (const rec of recs) {
        const restaurant = catalog.find((r) => r.id === rec.restaurant_id);
        if (!restaurant) continue;
        const score = scoreRestaurant(restaurant, solo).score;
        if (!best || score > best.score || (score === best.score && rec.rank < best.rank)) {
          best = { id: rec.id, score, rank: rec.rank };
        }
      }
      target = best?.id;
    }

    if (!target) target = rank1?.id;
    if (target) assigned.get(target)?.push(member);
  }

  return {
    squads: recs.map((r) => ({ recommendation: r, members: assigned.get(r.id) ?? [] })),
    skipping,
  };
}
