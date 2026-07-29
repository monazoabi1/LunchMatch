"use client";

import { aggregatePreferences } from "@/lib/scoring/aggregate";
import type { LunchState } from "@/lib/queries/state";

export default function Dashboard({ state }: { state: LunchState }) {
  const g = aggregatePreferences(state.prefs);
  const submitted = new Set(state.prefs.map((p) => p.user_id));

  return (
    <section className="rounded-xl bg-white p-5 shadow-sm">
      <h2 className="text-xs font-bold uppercase tracking-widest text-stone-400">
        Today&apos;s match pool
      </h2>

      <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <Stat label="Coming" value={`${g.yesCount} yes · ${g.maybeCount} maybe`} />
        <Stat
          label="Window"
          value={g.commonWindow ? `${g.commonWindow.from}–${g.commonWindow.to}` : "—"}
        />
        <Stat label="Budget" value={g.budgetCap ? `$${g.budgetCap}` : "—"} />
        <Stat
          label="Travel"
          value={g.attendeeCount ? `${g.groupTransport} ≤${g.maxWalkMinutes}m` : "—"}
        />
      </div>

      {g.sharedCategories.length > 0 && (
        <p className="mt-3 text-sm text-[var(--body)]">
          Craving:{" "}
          {g.sharedCategories.map((c) => (
            <span
              key={c}
              className="mr-1 inline-block rounded-full bg-pink-50 px-2 py-0.5 text-xs font-semibold text-[var(--tinder-pink)]"
            >
              {c}
            </span>
          ))}
        </p>
      )}
      {g.requiredDietary.length > 0 && (
        <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          🥗 Accommodating: {g.requiredDietary.join(", ").replaceAll("_", " ")}
        </p>
      )}
      {(() => {
        const withAllergies = state.prefs.filter(
          (p) => p.attendance !== "no" && p.allergies?.trim()
        );
        if (withAllergies.length === 0) return null;
        return (
          <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            ⚠️ Allergies:{" "}
            {withAllergies
              .map((p) => {
                const m = state.members.find((mm) => mm.id === p.user_id);
                return `${m?.display_name ?? "?"}: ${p.allergies.trim()}`;
              })
              .join(" · ")}
          </p>
        );
      })()}

      <div className="mt-3 flex flex-wrap gap-2">
        {state.members.map((m) => (
          <span
            key={m.id}
            title={submitted.has(m.id) ? "Profile in" : "Waiting…"}
            className={`pill border px-3 py-1 text-xs ${
              submitted.has(m.id)
                ? "border-[var(--like)] bg-emerald-50 text-emerald-700"
                : "border-stone-200 bg-stone-50 text-stone-400"
            }`}
          >
            {m.avatar_emoji} {m.display_name} {submitted.has(m.id) ? "✓" : "…"}
          </span>
        ))}
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-[var(--chrome)] p-2.5">
      <div className="text-[11px] text-stone-400">{label}</div>
      <div className="mt-0.5 text-[13px] font-semibold">{value}</div>
    </div>
  );
}
