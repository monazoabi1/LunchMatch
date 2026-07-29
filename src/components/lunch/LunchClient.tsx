"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { LunchState } from "@/lib/queries/state";
import { hasClientMode } from "@/lib/modes";
import PrefsForm from "./PrefsForm";
import Dashboard from "./Dashboard";
import SwipeDeck from "./SwipeDeck";
import ResultPanel from "./ResultPanel";
import CrewPanel from "./CrewPanel";

export default function LunchClient({
  initialState,
  demo = false,
}: {
  initialState: LunchState;
  demo?: boolean;
}) {
  const router = useRouter();
  const [state, setState] = useState<LunchState>(initialState);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"match" | "crew">("match");

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/session", { cache: "no-store" });
      if (res.ok) setState(await res.json());
    } catch {
      // transient network blip — the next poll will catch up
    }
  }, []);

  // Polling every 3s + a manual Refresh button. No Realtime, on purpose.
  useEffect(() => {
    const id = setInterval(refresh, 3000);
    return () => clearInterval(id);
  }, [refresh]);

  async function post(url: string, body?: object) {
    setBusy(true);
    try {
      await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    if (demo) {
      document.cookie = "lunchmatch_demo_user=; path=/; max-age=0";
    } else {
      await createClient().auth.signOut();
    }
    router.push("/login");
    router.refresh();
  }

  const { session, group, profile } = state;
  const status = session?.status ?? "collecting";

  return (
    <main className="mx-auto max-w-md pb-16">
      {/* ── Tinder-style top bar ── */}
      <header className="sticky top-0 z-40 mb-4 flex items-center justify-between border-b border-stone-200 bg-white px-4 py-3">
        <button
          onClick={signOut}
          title={`Signed in as ${profile.display_name} — sign out`}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-stone-100 text-lg"
        >
          {profile.avatar_emoji}
        </button>
        <div className="text-center leading-none">
          <span className="text-2xl font-extrabold tracking-tight">
            <span className="text-tinder">🔥 lunchmatch</span>
          </span>
          <p className="mt-0.5 text-[11px] text-stone-400">
            {group?.name} ·{" "}
            <span className="font-mono font-bold tracking-widest">{group?.invite_code}</span>
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {hasClientMode(profile.username) && (
            <a
              href="/mode"
              title="Switch mode"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-stone-100 text-lg text-stone-500"
            >
              ⇄
            </a>
          )}
          {!demo && profile.role === "admin" && (
            <a
              href="/admin/users"
              title="User management"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-stone-100 text-lg text-stone-500"
            >
              ⚙️
            </a>
          )}
          <button
            onClick={refresh}
            title="Refresh"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-stone-100 text-lg text-stone-500"
          >
            ↻
          </button>
        </div>
      </header>

      {/* ── Tabs: the match flow vs what the crew has chosen ── */}
      <div className="mb-4 flex justify-center gap-2 px-4">
        <button
          onClick={() => setTab("match")}
          className={`pill px-5 py-1.5 text-sm transition ${
            tab === "match"
              ? "bg-tinder text-white shadow"
              : "border border-stone-300 bg-white text-[var(--body)]"
          }`}
        >
          🔥 Match
        </button>
        <button
          onClick={() => setTab("crew")}
          className={`pill px-5 py-1.5 text-sm transition ${
            tab === "crew"
              ? "bg-tinder text-white shadow"
              : "border border-stone-300 bg-white text-[var(--body)]"
          }`}
        >
          👥 Crew (
          {status === "collecting"
            ? `${state.prefs.length}/${state.members.length} in`
            : `${state.votes.length}/${state.members.length} voted`}
          )
        </button>
      </div>

      {tab === "crew" && (
        <div className="px-4">
          <CrewPanel state={state} />
        </div>
      )}

      <div className={tab === "match" ? "px-4" : "hidden"}>
        {!session && (
          <div className="rounded-xl bg-white p-8 text-center shadow-sm">
            <p className="text-5xl">🔥</p>
            <p className="mt-2 text-[var(--body)]">No lunch decision in progress.</p>
            <button
              disabled={busy}
              onClick={() => post("/api/session")}
              className="pill bg-tinder mt-5 px-8 py-3 text-white shadow disabled:opacity-50"
            >
              Start matching
            </button>
          </div>
        )}

        {session && status === "collecting" && (
          <div className="space-y-4">
            <Dashboard state={state} />
            <PrefsForm state={state} onSaved={refresh} />
            <div className="pb-2 text-center">
              <button
                disabled={busy || state.prefs.filter((p) => p.attendance !== "no").length === 0}
                onClick={() => post("/api/recommend", { sessionId: session.id })}
                className="pill bg-tinder px-10 py-3.5 text-lg text-white shadow-lg transition hover:brightness-105 disabled:opacity-50"
              >
                🔥 Start swiping
              </button>
              <p className="mt-2 text-xs text-stone-400">
                Scores the restaurants and opens voting for everyone.
              </p>
            </div>
          </div>
        )}

        {session && status === "voting" && (
          <div className="space-y-4">
            {state.recommendations[0]?.score_breakdown.some(
              (l) => l.rule === "dietary_fail"
            ) && (
              <div className="rounded-xl border border-[var(--nope)]/30 bg-red-50 px-4 py-2 text-sm text-[var(--nope)]">
                No restaurant satisfies every dietary need — closest matches below.
              </div>
            )}
            <SwipeDeck
              recs={state.recommendations}
              votes={state.votes}
              members={state.members}
              myVote={state.votes.find((v) => v.user_id === profile.id)?.recommendation_id}
              onVote={(recommendationId) =>
                post("/api/vote", { sessionId: session.id, recommendationId })
              }
              disabled={busy}
            />
            <div className="pb-2 text-center">
              <button
                disabled={busy || state.votes.length === 0}
                onClick={() => post("/api/vote/close", { sessionId: session.id })}
                className="pill w-full max-w-sm border-2 border-[var(--ink)] bg-[var(--ink)] px-8 py-3 text-white shadow disabled:opacity-40"
              >
                🔨 End the Democracy ({state.votes.length}/{state.members.length} voted)
              </button>
            </div>
          </div>
        )}

        {session && status === "closed" && (
          <ResultPanel state={state} busy={busy} onNewSession={() => post("/api/session")} />
        )}
      </div>
    </main>
  );
}
