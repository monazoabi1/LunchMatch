import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DEMO_MODE } from "@/lib/demo/flag";
import { getDemoUserId } from "@/lib/demo/auth";
import { demoUpsertVote } from "@/lib/demo/store";

// One vote per user, DB-enforced via primary key (session_id, user_id) + upsert.
// A double-click on stage is harmless; changing your vote live is a feature.
export async function POST(request: Request) {
  const { sessionId, recommendationId } = await request.json();
  if (!sessionId || !recommendationId) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  if (DEMO_MODE) {
    const userId = await getDemoUserId();
    if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const { error } = demoUpsertVote(sessionId, userId, recommendationId);
    if (error) return NextResponse.json({ error }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { error } = await supabase.from("votes").upsert(
    { session_id: sessionId, user_id: user.id, recommendation_id: recommendationId },
    { onConflict: "session_id,user_id" }
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
