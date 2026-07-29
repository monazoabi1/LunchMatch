import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { RESTAURANTS } from "@/lib/restaurants";
import { computeAward } from "@/lib/scoring/award";
import { DEMO_MODE } from "@/lib/demo/flag";
import { getDemoUserId } from "@/lib/demo/auth";
import { demoCloseSession, demoGetState } from "@/lib/demo/store";
import type { Recommendation, Vote } from "@/types";

/**
 * "End the Democracy" — the voting → closed transition.
 * Tallies votes (ties broken by stored score, then rank), persists the winner
 * and the Difficult Coworker Award. Status-guarded: double-clicks are no-ops.
 */
function tally(recs: Recommendation[], votes: Vote[]): Recommendation {
  // Tally: vote count desc → stored score desc → rank asc. Fully deterministic.
  const counts = new Map<string, number>();
  for (const v of votes) {
    counts.set(v.recommendation_id, (counts.get(v.recommendation_id) ?? 0) + 1);
  }
  return [...recs].sort(
    (a, b) =>
      (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0) ||
      b.score - a.score ||
      a.rank - b.rank
  )[0];
}

export async function POST(request: Request) {
  const { sessionId } = await request.json();
  if (!sessionId) return NextResponse.json({ error: "missing_session" }, { status: 400 });

  if (DEMO_MODE) {
    const userId = await getDemoUserId();
    if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const state = demoGetState(userId);
    if (!state?.session || state.session.id !== sessionId || state.recommendations.length === 0) {
      return NextResponse.json({ error: "no_recommendations" }, { status: 400 });
    }
    const winner = tally(state.recommendations, state.votes);
    const award = computeAward(state.prefs, RESTAURANTS);
    const ok = demoCloseSession(sessionId, winner.id, award);
    return NextResponse.json({ ok: true, raced: !ok, winner_id: winner.id });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Load everything needed for the tally BEFORE claiming the transition.
  const [{ data: recs }, { data: votes }, { data: prefs }] = await Promise.all([
    supabase.from("recommendations").select("*").eq("session_id", sessionId),
    supabase.from("votes").select("*").eq("session_id", sessionId),
    supabase.from("lunch_preferences").select("*").eq("session_id", sessionId),
  ]);

  if (!recs || recs.length === 0) {
    return NextResponse.json({ error: "no_recommendations" }, { status: 400 });
  }

  const winner = tally(recs as Recommendation[], (votes ?? []) as Vote[]);

  // Dietary restrictions are deliberately excluded from the award computation.
  const award = computeAward(prefs ?? [], RESTAURANTS);

  const { data: claimed } = await supabase
    .from("daily_lunch_sessions")
    .update({
      status: "closed",
      closed_at: new Date().toISOString(),
      winner_recommendation_id: winner.id,
      difficult_coworker_id: award?.user_id ?? null,
      difficult_coworker_reason: award?.reason ?? null,
    })
    .eq("id", sessionId)
    .eq("status", "voting")
    .select();

  if (!claimed || claimed.length === 0) {
    return NextResponse.json({ ok: true, raced: true });
  }
  return NextResponse.json({ ok: true, winner_id: winner.id });
}
