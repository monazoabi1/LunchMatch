import type { GroupScoringInput, Restaurant, ScoreLine } from "@/types";
import { hhmmToMinutes } from "./aggregate";

export interface ScoredRestaurant {
  restaurant: Restaurant;
  score: number;
  eligible: boolean; // false = failed the dietary hard filter
  breakdown: ScoreLine[];
}

export interface ScoringResult {
  top3: ScoredRestaurant[];
  dietaryFallback: boolean; // true = no restaurant satisfied every dietary need
}

/** Score one restaurant against the aggregated group input. Exactly the spec rules. */
export function scoreRestaurant(r: Restaurant, g: GroupScoringInput): ScoredRestaurant {
  const breakdown: ScoreLine[] = [];
  let eligible = true;

  const satisfiesDietary = g.requiredDietary.every((tag) => r.dietary.includes(tag));
  if (!satisfiesDietary) {
    eligible = false;
    breakdown.push({ rule: "dietary_fail", points: -10, label: "Misses a dietary need" });
  } else {
    breakdown.push({ rule: "dietary_ok", points: 3, label: "Works for everyone's dietary needs" });
  }

  if (r.categories.some((c) => g.sharedCategories.includes(c))) {
    breakdown.push({ rule: "category_match", points: 3, label: "Matches what the group is craving" });
  }

  if (r.avgPrice <= g.budgetCap) {
    breakdown.push({ rule: "in_budget", points: 2, label: "Fits the group budget" });
  } else {
    breakdown.push({ rule: "over_budget", points: -3, label: "Over the group budget" });
  }

  const transportOk =
    g.groupTransport === "walk" ? true : g.groupTransport === "delivery" ? r.supportsDelivery : true;
  if (transportOk) {
    breakdown.push({ rule: "transport_ok", points: 2, label: transportLabel(g.groupTransport) });
  }

  if (g.groupTransport === "walk") {
    if (r.walkMinutes <= g.maxWalkMinutes) {
      breakdown.push({ rule: "walk_ok", points: 2, label: `${r.walkMinutes} min walk` });
    } else {
      breakdown.push({ rule: "over_walk", points: -2, label: "Too far for the group's walkers" });
    }
  }

  if (g.commonWindow) {
    const open = hhmmToMinutes(r.opensAt);
    const close = hhmmToMinutes(r.closesAt);
    const from = hhmmToMinutes(g.commonWindow.from);
    const to = hhmmToMinutes(g.commonWindow.to);
    if (open < to && close > from) {
      breakdown.push({ rule: "open_now", points: 1, label: "Open during your window" });
    }
  }

  return {
    restaurant: r,
    score: breakdown.reduce((s, l) => s + l.points, 0),
    eligible,
    breakdown,
  };
}

function transportLabel(mode: GroupScoringInput["groupTransport"]): string {
  return mode === "walk"
    ? "Walkable for the whole crew"
    : mode === "delivery"
      ? "Delivers to the office"
      : "Easy to drive to";
}

/**
 * Score the whole catalog. Deterministic: sort by score desc, tie-break by
 * avgPrice asc then id asc. If the dietary hard filter eliminates EVERY
 * restaurant, fall back to the highest-scored regardless of the filter
 * (dietaryFallback=true → UI shows the "closest options" banner).
 */
export function scoreAll(restaurants: Restaurant[], g: GroupScoringInput): ScoringResult {
  const scored = restaurants
    .map((r) => scoreRestaurant(r, g))
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.restaurant.avgPrice - b.restaurant.avgPrice ||
        a.restaurant.id.localeCompare(b.restaurant.id)
    );

  const eligible = scored.filter((s) => s.eligible);
  if (eligible.length > 0) {
    return { top3: eligible.slice(0, 3), dietaryFallback: false };
  }
  return { top3: scored.slice(0, 3), dietaryFallback: true };
}
