import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DEMO_MODE } from "@/lib/demo/flag";
import { DIETARY_TAGS, type DietaryTag } from "@/types";

// POST /api/account/profile-setup — the coworker completes their own profile.
// Dietary info is entered by the user personally, never by an administrator.
export async function POST(request: Request) {
  if (DEMO_MODE) return NextResponse.json({ error: "demo_mode" }, { status: 501 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const display_name = String(body.display_name ?? "").trim().slice(0, 60);
  const avatar_emoji = String(body.avatar_emoji ?? "🙂").slice(0, 8);
  const avatar_url = body.avatar_url ? String(body.avatar_url).slice(0, 500) : null;
  const allergies = String(body.allergies ?? "").trim().slice(0, 200);
  const dietary_restrictions = (Array.isArray(body.dietary_restrictions)
    ? body.dietary_restrictions
    : []
  ).filter((d: string): d is DietaryTag => (DIETARY_TAGS as readonly string[]).includes(d));

  if (!display_name) {
    return NextResponse.json({ error: "Display name is required." }, { status: 400 });
  }

  // Own-row update under the profiles_self RLS policy.
  const { error } = await supabase
    .from("profiles")
    .update({
      display_name,
      avatar_emoji,
      avatar_url,
      allergies,
      dietary_restrictions,
      profile_completed: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) return NextResponse.json({ error: "Could not save the profile." }, { status: 400 });
  return NextResponse.json({ ok: true, next: "/lunch" });
}
