import type { Restaurant } from "@/types";
import raw from "../../data/restaurants.json";

// The JSON is the single source of truth — no DB table, no seeding step.
// Validated once at module load so a bad edit fails loudly at build time,
// not silently at scoring time.
function validate(list: unknown): Restaurant[] {
  if (!Array.isArray(list) || list.length === 0) {
    throw new Error("restaurants.json must be a non-empty array");
  }
  const seen = new Set<string>();
  for (const r of list as Restaurant[]) {
    if (!r.id || !r.name || !Array.isArray(r.categories) || !Array.isArray(r.dietary)) {
      throw new Error(`restaurants.json: malformed entry ${JSON.stringify(r).slice(0, 80)}`);
    }
    if (seen.has(r.id)) throw new Error(`restaurants.json: duplicate id ${r.id}`);
    seen.add(r.id);
    if (typeof r.avgPrice !== "number" || typeof r.walkMinutes !== "number") {
      throw new Error(`restaurants.json: ${r.id} needs numeric avgPrice/walkMinutes`);
    }
    if (!/^\d{2}:\d{2}$/.test(r.opensAt) || !/^\d{2}:\d{2}$/.test(r.closesAt)) {
      throw new Error(`restaurants.json: ${r.id} has bad opensAt/closesAt (want HH:MM)`);
    }
  }
  return list as Restaurant[];
}

export const RESTAURANTS: Restaurant[] = validate(raw);

export function getRestaurant(id: string): Restaurant | undefined {
  return RESTAURANTS.find((r) => r.id === id);
}
