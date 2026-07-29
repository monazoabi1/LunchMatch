import type {
  DietaryTag,
  FoodCategory,
  GroupScoringInput,
  HHMM,
  LunchPreference,
  TransportMode,
} from "@/types";

export function hhmmToMinutes(t: HHMM): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToHhmm(min: number): HHMM {
  const h = String(Math.floor(min / 60)).padStart(2, "0");
  const m = String(min % 60).padStart(2, "0");
  return `${h}:${m}`;
}

const weightOf = (attendance: string) => (attendance === "yes" ? 1 : attendance === "maybe" ? 0.5 : 0);

/**
 * Collapse all submitted preferences for a session into one GroupScoringInput.
 * Pure + synchronous — the only inputs are the preference rows.
 */
export function aggregatePreferences(prefs: LunchPreference[]): GroupScoringInput {
  const attendees = prefs.filter((p) => p.attendance !== "no");
  const yes = prefs.filter((p) => p.attendance === "yes");
  const maybe = prefs.filter((p) => p.attendance === "maybe");

  // Hard filter: union of dietary needs over ALL attendees including maybes.
  const requiredDietary = [...new Set(attendees.flatMap((p) => p.dietary))] as DietaryTag[];

  // Categories chosen by at least ~1/3 of weighted attendees.
  const totalWeight = attendees.reduce((s, p) => s + weightOf(p.attendance), 0);
  const catWeights = new Map<FoodCategory, number>();
  for (const p of attendees) {
    for (const c of p.categories) {
      catWeights.set(c, (catWeights.get(c) ?? 0) + weightOf(p.attendance));
    }
  }
  const sharedCategories = [...catWeights.entries()]
    .filter(([, w]) => totalWeight > 0 && w >= totalWeight / 3)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([c]) => c);

  // Average budget of attendees (matches the dashboard display).
  const budgetCap =
    attendees.length > 0
      ? Math.round((attendees.reduce((s, p) => s + Number(p.max_budget), 0) / attendees.length) * 100) / 100
      : 0;

  // Most-selected transport mode, weighted; deterministic tie-break by mode name.
  const transportWeights = new Map<TransportMode, number>();
  for (const p of attendees) {
    transportWeights.set(p.transport, (transportWeights.get(p.transport) ?? 0) + weightOf(p.attendance));
  }
  const groupTransport: TransportMode =
    [...transportWeights.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? "walk";

  // Strictest walker sets the ceiling.
  const maxWalkMinutes =
    attendees.length > 0 ? Math.min(...attendees.map((p) => p.max_walking_minutes)) : 0;

  // Intersection of availability over confirmed ('yes') attendees only.
  let commonWindow: { from: HHMM; to: HHMM } | null = null;
  if (yes.length > 0) {
    const from = Math.max(...yes.map((p) => hhmmToMinutes(normalize(p.available_from))));
    const to = Math.min(...yes.map((p) => hhmmToMinutes(normalize(p.available_to))));
    if (from < to) commonWindow = { from: minutesToHhmm(from), to: minutesToHhmm(to) };
  }

  return {
    attendeeCount: attendees.length,
    yesCount: yes.length,
    maybeCount: maybe.length,
    noCount: prefs.length - attendees.length,
    requiredDietary,
    sharedCategories,
    budgetCap,
    groupTransport,
    maxWalkMinutes,
    commonWindow,
  };
}

// Postgres `time` columns come back as 'HH:MM:SS' — normalize to HH:MM.
function normalize(t: string): HHMM {
  return t.slice(0, 5);
}
