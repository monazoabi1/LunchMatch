import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { RESTAURANTS } from "@/lib/restaurants";
import { aggregatePreferences } from "@/lib/scoring/aggregate";
import { scoreAll } from "@/lib/scoring/score";
import { enrichRecommendations } from "@/lib/ai/enrich";
import { buildFallbackEnrichment } from "@/lib/ai/fallback";
import { DEMO_MODE } from "@/lib/demo/flag";
import { getDemoUserId } from "@/lib/demo/auth";
import {
  demoClaimTransition,
  demoGetPrefs,
  demoInsertRecommendations,
} from "@/lib/demo/store";
import type { LunchPreference, ScoreLine } from "@/types";

interface SnapshotRec {
  restaurant_id: string;
  restaurant_name: string;
  rank: number;
  score: number;
  score_breakdown: ScoreLine[];
  ai_why: string | null;
  ai_slogan: string | null;
  ai_source: "ai" | "fallback";
}

/**
 * Deterministic scoring snapshot for the WHOLE ranked catalog + exactly one AI
 * call (invisible fallback). The AI writes copy for the top 3 only — keeping
 * that call small and fast is what makes it safe to run on a live demo click.
 * Everything below the podium gets the same deterministic copy the fallback
 * path produces, so every card in the deck reads consistently.
 */
async function computeSnapshot(prefs: LunchPreference[]): Promise<SnapshotRec[]> {
  const group = aggregatePreferences(prefs);
  const { ranked } = scoreAll(RESTAURANTS, group);

  const recInputs = ranked.map((s, i) => ({
    restaurant_id: s.restaurant.id,
    restaurant_name: s.restaurant.name,
    rank: i + 1,
    score: s.score,
    score_breakdown: s.breakdown,
  }));

  const podium = recInputs.slice(0, 3);
  const { enrichment, source } = await enrichRecommendations(podium, group);
  const restCopy = buildFallbackEnrichment(recInputs.slice(3), group);
  const copyById = new Map(
    [...enrichment.restaurants, ...restCopy.restaurants].map((r) => [r.restaurant_id, r])
  );

  return recInputs.map((r, i) => ({
    ...r,
    ai_why: copyById.get(r.restaurant_id)?.why_it_fits ?? null,
    ai_slogan: copyById.get(r.restaurant_id)?.slogan ?? null,
    ai_source: i < podium.length ? source : ("fallback" as const),
  }));
}

/**
 * "Show us the options" — the collecting → voting transition.
 * Status-guarded claim makes a double-click (or two simultaneous clicks) a
 * harmless no-op. Client sends only { sessionId }.
 */
export async function POST(request: Request) {
  const { sessionId } = await request.json();
  if (!sessionId) return NextResponse.json({ error: "missing_session" }, { status: 400 });

  if (DEMO_MODE) {
    const userId = await getDemoUserId();
    if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const prefs = demoGetPrefs(sessionId);
    if (prefs.filter((p) => p.attendance !== "no").length === 0) {
      return NextResponse.json({ error: "no_attendees" }, { status: 400 });
    }
    if (!demoClaimTransition(sessionId, "collecting", "voting")) {
      return NextResponse.json({ ok: true, raced: true });
    }
    const recs = await computeSnapshot(prefs);
    demoInsertRecommendations(recs.map((r) => ({ session_id: sessionId, ...r })));
    return NextResponse.json({ ok: true });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: prefs } = await supabase
    .from("lunch_preferences")
    .select("*")
    .eq("session_id", sessionId);

  const attendees = (prefs ?? []).filter((p: LunchPreference) => p.attendance !== "no");
  if (attendees.length === 0) {
    return NextResponse.json({ error: "no_attendees" }, { status: 400 });
  }

  // Atomic claim: only succeeds if still 'collecting'.
  const { data: claimed } = await supabase
    .from("daily_lunch_sessions")
    .update({ status: "voting" })
    .eq("id", sessionId)
    .eq("status", "collecting")
    .select();

  if (!claimed || claimed.length === 0) {
    return NextResponse.json({ ok: true, raced: true });
  }

  const recs = await computeSnapshot(prefs ?? []);
  const { error: insertError } = await supabase
    .from("recommendations")
    .insert(recs.map((r) => ({ session_id: sessionId, ...r })));

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
