import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getLunchState } from "@/lib/queries/state";
import { DEMO_MODE } from "@/lib/demo/flag";
import { getDemoUserId } from "@/lib/demo/auth";
import { demoGetState, demoNewSession } from "@/lib/demo/store";

// Polled every 3s by the lunch page.
export async function GET() {
  if (DEMO_MODE) {
    const userId = await getDemoUserId();
    if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const state = demoGetState(userId);
    if (!state) return NextResponse.json({ error: "no_profile" }, { status: 404 });
    return NextResponse.json(state);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const state = await getLunchState(supabase, user.id);
  if (!state) return NextResponse.json({ error: "no_profile" }, { status: 404 });
  return NextResponse.json(state);
}

// "Start new lunch decision" — closes any open session, inserts a fresh
// 'collecting' row. Old sessions are kept for history. This doubles as the
// demo's reset button.
export async function POST() {
  if (DEMO_MODE) {
    const userId = await getDemoUserId();
    if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    return NextResponse.json({ ok: true, session: demoNewSession() });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("group_id")
    .eq("id", user.id)
    .single();
  if (!profile?.group_id) {
    return NextResponse.json({ error: "no_group" }, { status: 400 });
  }

  await supabase
    .from("daily_lunch_sessions")
    .update({ status: "closed", closed_at: new Date().toISOString() })
    .eq("group_id", profile.group_id)
    .neq("status", "closed");

  const { data: session, error } = await supabase
    .from("daily_lunch_sessions")
    .insert({ group_id: profile.group_id })
    .select()
    .single();

  if (error) {
    // Unique-index race: someone else already opened a session — harmless no-op.
    return NextResponse.json({ ok: true, raced: true });
  }
  return NextResponse.json({ ok: true, session });
}
