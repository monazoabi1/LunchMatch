import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DEMO_MODE } from "@/lib/demo/flag";
import { getDemoUserId } from "@/lib/demo/auth";
import { demoUpsertPref } from "@/lib/demo/store";

// Submit / update the caller's preferences for a session. In real mode RLS
// enforces user_id = auth.uid() and status = 'collecting'; the demo store
// mirrors those checks.
export async function POST(request: Request) {
  const body = await request.json();
  const { sessionId, ...pref } = body;
  if (!sessionId) return NextResponse.json({ error: "missing_session" }, { status: 400 });

  const fields = {
    attendance: pref.attendance,
    available_from: pref.available_from,
    available_to: pref.available_to,
    max_budget: pref.max_budget,
    categories: pref.categories ?? [],
    dietary: pref.dietary ?? [],
    allergies: typeof pref.allergies === "string" ? pref.allergies.slice(0, 200) : "",
    transport: pref.transport,
    max_walking_minutes: pref.max_walking_minutes,
    comment: pref.comment ?? "",
  };

  if (DEMO_MODE) {
    const userId = await getDemoUserId();
    if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const { error } = demoUpsertPref({ session_id: sessionId, user_id: userId, ...fields });
    if (error) return NextResponse.json({ error }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { error } = await supabase.from("lunch_preferences").upsert(
    {
      session_id: sessionId,
      user_id: user.id,
      ...fields,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "session_id,user_id" }
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
