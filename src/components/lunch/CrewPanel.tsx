"use client";

import { getRestaurant } from "@/lib/restaurants";
import type { LunchState } from "@/lib/queries/state";

/**
 * The Crew tab — what everyone else has chosen, live.
 * Collecting: who has submitted preferences and what they're craving.
 * Voting/closed: who swiped right on what.
 */
export default function CrewPanel({ state }: { state: LunchState }) {
  const { members, prefs, votes, recommendations, session } = state;
  const status = session?.status ?? "collecting";

  return (
    <div className="space-y-3">
      {members.map((m) => {
        const pref = prefs.find((p) => p.user_id === m.id);
        const vote = votes.find((v) => v.user_id === m.id);
        const votedRec = vote
          ? recommendations.find((r) => r.id === vote.recommendation_id)
          : undefined;
        const votedRestaurant = votedRec ? getRestaurant(votedRec.restaurant_id) : undefined;

        return (
          <div key={m.id} className="rounded-xl bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="font-bold">
                {m.avatar_emoji} {m.display_name}
              </span>
              {pref ? (
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                    pref.attendance === "yes"
                      ? "bg-emerald-100 text-emerald-700"
                      : pref.attendance === "maybe"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-stone-100 text-stone-500"
                  }`}
                >
                  {pref.attendance === "yes"
                    ? "✅ in"
                    : pref.attendance === "maybe"
                      ? "🤔 maybe"
                      : "❌ out"}
                </span>
              ) : (
                <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs text-stone-400">
                  no profile yet
                </span>
              )}
            </div>

            {pref && pref.attendance !== "no" && (
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--body)]">
                <span>💰 up to ${Number(pref.max_budget)}</span>
                <span>
                  🕐 {pref.available_from.slice(0, 5)}–{pref.available_to.slice(0, 5)}
                </span>
                <span>
                  {pref.transport === "walk"
                    ? `🚶 ≤${pref.max_walking_minutes} min`
                    : pref.transport === "car"
                      ? "🚗 driving"
                      : "🛵 delivery"}
                </span>
                {pref.categories.length > 0 && (
                  <span>😋 {pref.categories.join(", ")}</span>
                )}
                {pref.dietary.length > 0 && (
                  <span className="text-emerald-700">
                    🥗 {pref.dietary.join(", ").replaceAll("_", " ")}
                  </span>
                )}
                {pref.allergies?.trim() && (
                  <span className="text-amber-700">⚠️ {pref.allergies.trim()}</span>
                )}
                {pref.comment && <span className="italic">“{pref.comment}”</span>}
              </div>
            )}

            {status !== "collecting" && (
              <div className="mt-2 border-t border-stone-100 pt-2 text-sm">
                {votedRec ? (
                  <span className="font-semibold text-[var(--tinder-pink)]">
                    ♥ swiped right on {votedRestaurant?.emoji} {votedRec.restaurant_name}
                  </span>
                ) : pref?.attendance === "no" ? (
                  <span className="text-stone-400">sitting this one out</span>
                ) : (
                  <span className="text-stone-400">
                    {status === "voting" ? "still deciding…" : "never voted"}
                  </span>
                )}
              </div>
            )}
          </div>
        );
      })}

      {status === "voting" && (
        <p className="text-center text-xs text-stone-400">
          Updates live every few seconds — watch your coworkers cave to peer pressure.
        </p>
      )}
    </div>
  );
}
