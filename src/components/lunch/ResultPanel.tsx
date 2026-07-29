"use client";

import { aggregatePreferences } from "@/lib/scoring/aggregate";
import { computeSquads } from "@/lib/scoring/squads";
import { getRestaurant, RESTAURANTS } from "@/lib/restaurants";
import { DESSERTS } from "@/lib/desserts";
import type { LunchState } from "@/lib/queries/state";

export default function ResultPanel({
  state,
  busy,
  onNewSession,
}: {
  state: LunchState;
  busy: boolean;
  onNewSession: () => void;
}) {
  const { session, recommendations, votes, members, prefs } = state;
  const winner = recommendations.find((r) => r.id === session?.winner_recommendation_id);
  const restaurant = winner ? getRestaurant(winner.restaurant_id) : undefined;
  const g = aggregatePreferences(prefs);

  const winnerVoters = votes.filter((v) => v.recommendation_id === winner?.id);
  const dissenters = votes
    .filter((v) => v.recommendation_id !== winner?.id)
    .map((v) => members.find((m) => m.id === v.user_id))
    .filter(Boolean);

  const awardee = members.find((m) => m.id === session?.difficult_coworker_id);
  const { squads, skipping } = computeSquads(recommendations, votes, members, prefs, RESTAURANTS);
  const activeSquads = squads.filter((s) => s.members.length > 0);
  // Stable per-session dessert pick, so everyone sees the same suggestion.
  const dessertPick =
    DESSERTS.length > 0
      ? DESSERTS[
          Math.abs(
            [...(session?.id ?? "")].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0)
          ) % DESSERTS.length
        ]
      : undefined;

  return (
    <div className="space-y-4">
      {/* ── "It's a Match!" — full-gradient Tinder match screen ── */}
      <section className="bg-tinder relative overflow-hidden rounded-2xl p-8 text-center text-white shadow-lg">
        <h2 className="match-script text-5xl drop-shadow">It&apos;s a Match!</h2>
        <p className="mt-1 text-sm text-white/85">
          The whole office swiped right on…
        </p>

        <div className="mt-6 flex items-center justify-center gap-4">
          <div className="flex h-28 w-28 items-center justify-center rounded-full border-4 border-white bg-white/20 text-6xl shadow-lg backdrop-blur">
            {restaurant?.emoji ?? "🍽️"}
          </div>
          <span className="text-3xl">💘</span>
          <div className="flex h-28 w-28 flex-wrap items-center justify-center rounded-full border-4 border-white bg-white/20 p-2 text-2xl shadow-lg backdrop-blur">
            {members.slice(0, 4).map((m) => (
              <span key={m.id}>{m.avatar_emoji}</span>
            ))}
          </div>
        </div>

        <h3 className="mt-5 text-2xl font-extrabold">{winner?.restaurant_name}</h3>
        {winner?.ai_slogan && (
          <p className="mt-0.5 text-sm italic text-white/90">“{winner.ai_slogan}”</p>
        )}

        <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm text-white/90">
          <span>🗳️ {winnerVoters.length}/{votes.length} votes</span>
          {g.commonWindow && <span>🕐 Leave at {g.commonWindow.from}</span>}
          {session?.meeting_point && <span>📍 {session.meeting_point}</span>}
          {restaurant && <span>🚶 {restaurant.walkMinutes} min</span>}
        </div>
        {dissenters.length > 0 && (
          <p className="mt-3 text-xs text-white/60">
            Swiped left, will complain at the table:{" "}
            {dissenters.map((d) => d!.display_name).join(", ")}
          </p>
        )}

        <button
          disabled={busy}
          onClick={onNewSession}
          className="pill mt-6 w-full bg-white py-3 text-base text-[var(--tinder-rose)] shadow disabled:opacity-60"
        >
          Keep Swiping — new lunch decision
        </button>
      </section>

      {/* ── Difficult Coworker Award ── */}
      {awardee && (
        <section className="rounded-2xl bg-white p-6 text-center shadow-sm">
          <p className="text-xs font-bold uppercase tracking-widest text-stone-400">
            🏆 Difficult Coworker Award
          </p>
          <p className="mt-2 text-xl font-extrabold">
            {awardee.avatar_emoji} {awardee.display_name}
          </p>
          <p className="text-sm text-[var(--body)]">
            …who {session?.difficult_coworker_reason ?? "kept us on our toes"}.
          </p>
          <p className="mt-2 text-[11px] text-stone-400">
            Computed from budget, distance, time and cravings only — dietary needs are
            excluded by design.
          </p>
        </section>
      )}

      {/* ── Lunch squads — who's going where ── */}
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-widest text-stone-400">
          🍽️ Lunch squads — who&apos;s going where
        </p>
        <div className="mt-3 space-y-3">
          {activeSquads.map(({ recommendation: rec, members: squadMembers }) => {
            const r = getRestaurant(rec.restaurant_id);
            return (
              <div
                key={rec.id}
                className={`rounded-xl border p-4 ${
                  rec.id === winner?.id
                    ? "border-[var(--tinder-pink)] bg-pink-50/50"
                    : "border-stone-200"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold">
                    {r?.emoji} {rec.restaurant_name}
                    {rec.id === winner?.id && " 👑"}
                  </span>
                  <span className="text-xs text-stone-400">
                    🚶 {r?.walkMinutes} min · {squadMembers.length} going
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {squadMembers.map((m) => (
                    <span
                      key={m.id}
                      className="pill border border-stone-200 bg-white px-2.5 py-1 text-xs"
                    >
                      {m.avatar_emoji} {m.display_name}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
          {skipping.length > 0 && (
            <p className="text-xs text-stone-400">
              Skipping today: {skipping.map((m) => m.display_name).join(", ")}
            </p>
          )}
        </div>
      </section>

      {/* ── Round 2: dessert ── */}
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-widest text-stone-400">
          🍨 Round 2: dessert?
        </p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {DESSERTS.map((d) => (
            <div
              key={d.id}
              className={`overflow-hidden rounded-xl border ${
                d.id === dessertPick?.id
                  ? "border-[var(--tinder-pink)] ring-2 ring-pink-100"
                  : "border-stone-200"
              }`}
            >
              <div className="relative h-24 bg-stone-100">
                {d.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={d.imageUrl}
                    alt={d.name}
                    className="absolute inset-0 h-full w-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                )}
                <span className="absolute inset-0 -z-10 flex items-center justify-center text-4xl">
                  {d.emoji}
                </span>
                {d.id === dessertPick?.id && (
                  <span className="absolute right-1.5 top-1.5 rounded-full bg-[var(--tinder-pink)] px-2 py-0.5 text-[10px] font-bold text-white">
                    Group pick
                  </span>
                )}
              </div>
              <div className="p-2.5">
                <p className="text-sm font-bold">
                  {d.emoji} {d.name}
                </p>
                <p className="text-xs text-stone-500">{d.description}</p>
                <p className="mt-1 text-[11px] text-stone-400">🚶 {d.walkMinutes} min</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Full results ── */}
      <details className="rounded-2xl bg-white p-5 shadow-sm">
        <summary className="cursor-pointer text-sm font-semibold text-[var(--body)]">
          Full results
        </summary>
        <div className="mt-3 space-y-3">
          {recommendations.map((rec) => {
            const r = getRestaurant(rec.restaurant_id);
            const recVotes = votes.filter((v) => v.recommendation_id === rec.id);
            return (
              <div key={rec.id} className="rounded-xl border border-stone-200 p-4">
                <div className="flex items-center justify-between">
                  <span className="font-bold">
                    {r?.emoji} {rec.restaurant_name}
                    {rec.id === winner?.id && " 👑"}
                  </span>
                  <span className="text-sm text-stone-500">
                    {recVotes.length} votes · {rec.score} pts
                  </span>
                </div>
                {rec.ai_why && (
                  <p className="mt-1 text-sm text-[var(--body)]">{rec.ai_why}</p>
                )}
                <ul className="mt-2 space-y-0.5">
                  {rec.score_breakdown.map((line, i) => (
                    <li key={i} className="flex justify-between text-xs text-stone-500">
                      <span>{line.label}</span>
                      <span
                        className="font-bold"
                        style={{ color: line.points >= 0 ? "var(--like)" : "var(--nope)" }}
                      >
                        {line.points >= 0 ? `+${line.points}` : line.points}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </details>
    </div>
  );
}
