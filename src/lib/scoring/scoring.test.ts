import { describe, expect, it } from "vitest";
import type { LunchPreference, Restaurant } from "@/types";
import { aggregatePreferences } from "./aggregate";
import { scoreAll, scoreRestaurant } from "./score";
import { computeAward } from "./award";

let prefSeq = 0;
function pref(overrides: Partial<LunchPreference> = {}): LunchPreference {
  prefSeq++;
  return {
    id: `pref-${prefSeq}`,
    session_id: "s1",
    user_id: `user-${prefSeq}`,
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

function restaurant(overrides: Partial<Restaurant> = {}): Restaurant {
  return {
    id: "r1",
    name: "Testaurant",
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

describe("aggregatePreferences", () => {
  it("handles an empty group without crashing", () => {
    const g = aggregatePreferences([]);
    expect(g.attendeeCount).toBe(0);
    expect(g.commonWindow).toBeNull();
    expect(g.budgetCap).toBe(0);
    expect(g.requiredDietary).toEqual([]);
  });

  it("handles all-'no' attendance", () => {
    const g = aggregatePreferences([
      pref({ attendance: "no" }),
      pref({ attendance: "no" }),
    ]);
    expect(g.attendeeCount).toBe(0);
    expect(g.noCount).toBe(2);
    expect(g.commonWindow).toBeNull();
  });

  it("unions dietary over yes AND maybe attendees", () => {
    const g = aggregatePreferences([
      pref({ dietary: ["vegetarian"] }),
      pref({ attendance: "maybe", dietary: ["gluten_free"] }),
      pref({ attendance: "no", dietary: ["kosher"] }), // excluded
    ]);
    expect(g.requiredDietary.sort()).toEqual(["gluten_free", "vegetarian"]);
  });

  it("takes the MINIMUM walk minutes (strictest walker wins)", () => {
    const g = aggregatePreferences([
      pref({ max_walking_minutes: 20 }),
      pref({ max_walking_minutes: 5 }),
    ]);
    expect(g.maxWalkMinutes).toBe(5);
  });

  it("intersects availability over 'yes' attendees only", () => {
    const g = aggregatePreferences([
      pref({ available_from: "12:00", available_to: "13:00" }),
      pref({ available_from: "12:30", available_to: "14:00" }),
      pref({ attendance: "maybe", available_from: "09:00", available_to: "09:30" }),
    ]);
    expect(g.commonWindow).toEqual({ from: "12:30", to: "13:00" });
  });

  it("returns null commonWindow when yes-windows don't overlap", () => {
    const g = aggregatePreferences([
      pref({ available_from: "12:00", available_to: "12:30" }),
      pref({ available_from: "13:00", available_to: "14:00" }),
    ]);
    expect(g.commonWindow).toBeNull();
  });

  it("normalizes Postgres HH:MM:SS time strings", () => {
    const g = aggregatePreferences([
      pref({ available_from: "12:00:00", available_to: "13:30:00" }),
    ]);
    expect(g.commonWindow).toEqual({ from: "12:00", to: "13:30" });
  });
});

describe("scoreRestaurant", () => {
  const base = aggregatePreferences([pref({ categories: ["pizza"], max_budget: 12 })]);

  it("applies -10 and marks ineligible when a dietary need is missed", () => {
    const g = aggregatePreferences([pref({ dietary: ["vegan"] })]);
    const s = scoreRestaurant(restaurant({ dietary: [] }), g);
    expect(s.eligible).toBe(false);
    expect(s.breakdown.find((l) => l.rule === "dietary_fail")?.points).toBe(-10);
  });

  it("rewards budget fit and penalizes over-budget", () => {
    const inBudget = scoreRestaurant(restaurant({ avgPrice: 12 }), base);
    const overBudget = scoreRestaurant(restaurant({ avgPrice: 12.01 }), base);
    expect(inBudget.breakdown.find((l) => l.rule === "in_budget")?.points).toBe(2);
    expect(overBudget.breakdown.find((l) => l.rule === "over_budget")?.points).toBe(-3);
  });

  it("penalizes over-walk only when the group walks", () => {
    const walkers = aggregatePreferences([pref({ max_walking_minutes: 5 })]);
    const drivers = aggregatePreferences([pref({ transport: "car" })]);
    const far = restaurant({ walkMinutes: 15 });
    expect(scoreRestaurant(far, walkers).breakdown.some((l) => l.rule === "over_walk")).toBe(true);
    expect(scoreRestaurant(far, drivers).breakdown.some((l) => l.rule === "over_walk")).toBe(false);
  });

  it("boundary: walkMinutes exactly at the max counts as ok", () => {
    const g = aggregatePreferences([pref({ max_walking_minutes: 10 })]);
    const s = scoreRestaurant(restaurant({ walkMinutes: 10 }), g);
    expect(s.breakdown.find((l) => l.rule === "walk_ok")?.points).toBe(2);
  });
});

describe("scoreAll", () => {
  it("falls back to top-scored when dietary eliminates EVERY restaurant", () => {
    const g = aggregatePreferences([pref({ dietary: ["kosher"] })]);
    const catalog = [
      restaurant({ id: "a", dietary: [] }),
      restaurant({ id: "b", dietary: ["vegan"] }),
    ];
    const result = scoreAll(catalog, g);
    expect(result.dietaryFallback).toBe(true);
    expect(result.top3.length).toBe(2);
  });

  it("excludes ineligible restaurants when eligible ones exist", () => {
    const g = aggregatePreferences([pref({ dietary: ["vegan"] })]);
    const catalog = [
      restaurant({ id: "ok", dietary: ["vegan"] }),
      restaurant({ id: "bad", dietary: [] }),
    ];
    const result = scoreAll(catalog, g);
    expect(result.dietaryFallback).toBe(false);
    expect(result.top3.map((s) => s.restaurant.id)).toEqual(["ok"]);
  });

  it("tie-breaks deterministically: price asc, then id asc", () => {
    const g = aggregatePreferences([pref()]);
    const catalog = [
      restaurant({ id: "zed", avgPrice: 10 }),
      restaurant({ id: "abe", avgPrice: 10 }),
      restaurant({ id: "cheap", avgPrice: 5 }),
    ];
    const r1 = scoreAll(catalog, g);
    const r2 = scoreAll([...catalog].reverse(), g);
    expect(r1.top3.map((s) => s.restaurant.id)).toEqual(["cheap", "abe", "zed"]);
    expect(r2.top3.map((s) => s.restaurant.id)).toEqual(r1.top3.map((s) => s.restaurant.id));
  });
});

describe("computeAward", () => {
  it("returns null with fewer than 2 attendees", () => {
    expect(computeAward([pref()], [restaurant()])).toBeNull();
    expect(
      computeAward([pref(), pref({ attendance: "no" })], [restaurant()])
    ).toBeNull();
  });

  it("gives the award to the person with the fewest personal matches", () => {
    const catalog = [
      restaurant({ id: "a", avgPrice: 10 }),
      restaurant({ id: "b", avgPrice: 20 }),
      restaurant({ id: "c", avgPrice: 30 }),
    ];
    const easy = pref({ user_id: "easy", max_budget: 50 });
    const picky = pref({ user_id: "picky", max_budget: 12 });
    const award = computeAward([easy, picky], catalog);
    expect(award?.user_id).toBe("picky");
    expect(award?.reason).toBe("held the line on the budget");
  });

  it("NEVER counts dietary restrictions against anyone", () => {
    const catalog = [restaurant({ id: "a", dietary: [] })];
    const dietaryHeavy = pref({
      user_id: "dietary-person",
      dietary: ["vegan", "gluten_free", "kosher", "nut_free"],
    });
    const budgetPicky = pref({ user_id: "budget-person", max_budget: 1 });
    const award = computeAward([dietaryHeavy, budgetPicky], catalog);
    // dietary-person matches everything (dietary excluded); budget-person matches nothing
    expect(award?.user_id).toBe("budget-person");
  });
});
