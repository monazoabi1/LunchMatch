import { describe, expect, it } from "vitest";
import type { LunchPreference, Profile, Recommendation, Restaurant } from "@/types";
import { computeSquads } from "./squads";

function member(id: string): Profile {
  return { id, display_name: id, avatar_emoji: "🙂", group_id: "g1" };
}

let prefSeq = 0;
function pref(userId: string, overrides: Partial<LunchPreference> = {}): LunchPreference {
  return {
    id: `p-${++prefSeq}`,
    session_id: "s1",
    user_id: userId,
    attendance: "yes",
    available_from: "12:00",
    available_to: "13:00",
    max_budget: 15,
    categories: [],
    dietary: [],
    allergies: "",
    transport: "walk",
    max_walking_minutes: 10,
    comment: "",
    updated_at: "",
    ...overrides,
  };
}

function restaurant(id: string, overrides: Partial<Restaurant> = {}): Restaurant {
  return {
    id,
    name: id,
    emoji: "🍽️",
    description: "",
    categories: ["pizza"],
    avgPrice: 10,
    dietary: [],
    walkMinutes: 5,
    supportsDelivery: true,
    deliveryMinutes: 30,
    opensAt: "11:00",
    closesAt: "15:00",
    ...overrides,
  };
}

function rec(id: string, restaurantId: string, rank: 1 | 2 | 3): Recommendation {
  return {
    id,
    session_id: "s1",
    restaurant_id: restaurantId,
    restaurant_name: restaurantId,
    rank,
    score: 10 - rank,
    score_breakdown: [],
    ai_why: null,
    ai_slogan: null,
    ai_source: null,
  };
}

const catalog = [
  restaurant("cheap-pizza", { categories: ["pizza"], avgPrice: 8 }),
  restaurant("pricey-sushi", { categories: ["sushi"], avgPrice: 30 }),
  restaurant("mid-salad", { categories: ["salad"], avgPrice: 12 }),
];
const recs = [
  rec("r1", "cheap-pizza", 1),
  rec("r2", "pricey-sushi", 2),
  rec("r3", "mid-salad", 3),
];

describe("computeSquads", () => {
  it("puts voters in the squad they voted for", () => {
    const { squads } = computeSquads(
      recs,
      [
        { user_id: "a", recommendation_id: "r2" },
        { user_id: "b", recommendation_id: "r1" },
      ],
      [member("a"), member("b")],
      [pref("a"), pref("b")],
      catalog
    );
    expect(squads.find((s) => s.recommendation.id === "r2")?.members.map((m) => m.id)).toEqual(["a"]);
    expect(squads.find((s) => s.recommendation.id === "r1")?.members.map((m) => m.id)).toEqual(["b"]);
  });

  it("assigns non-voters to their best personal match", () => {
    // sushi-lover with a big budget didn't vote → should land on pricey-sushi
    const { squads } = computeSquads(
      recs,
      [],
      [member("sushi-fan")],
      [pref("sushi-fan", { categories: ["sushi"], max_budget: 40 })],
      catalog
    );
    expect(
      squads.find((s) => s.recommendation.id === "r2")?.members.map((m) => m.id)
    ).toEqual(["sushi-fan"]);
  });

  it("sends silent members (no vote, no prefs) to the rank-1 pick", () => {
    const { squads } = computeSquads(recs, [], [member("ghost")], [], catalog);
    expect(squads.find((s) => s.recommendation.rank === 1)?.members.map((m) => m.id)).toEqual([
      "ghost",
    ]);
  });

  it("lists attendance='no' members under skipping, not in any squad", () => {
    const { squads, skipping } = computeSquads(
      recs,
      [{ user_id: "out", recommendation_id: "r1" }], // even a stray vote doesn't count
      [member("out")],
      [pref("out", { attendance: "no" })],
      catalog
    );
    expect(skipping.map((m) => m.id)).toEqual(["out"]);
    expect(squads.every((s) => s.members.length === 0)).toBe(true);
  });

  it("is deterministic for identical inputs", () => {
    const run = () =>
      computeSquads(
        recs,
        [{ user_id: "a", recommendation_id: "r3" }],
        [member("a"), member("b")],
        [pref("a"), pref("b", { categories: ["pizza"] })],
        catalog
      );
    expect(JSON.stringify(run())).toBe(JSON.stringify(run()));
  });
});
