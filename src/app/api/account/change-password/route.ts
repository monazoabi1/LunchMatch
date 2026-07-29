import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validatePasswordStrength } from "@/lib/auth/password";
import { clientKey, rateLimit } from "@/lib/auth/rate-limit";
import { DEMO_MODE } from "@/lib/demo/flag";

// POST /api/account/change-password — first-login (or voluntary) password change.
export async function POST(request: Request) {
  if (DEMO_MODE) return NextResponse.json({ error: "demo_mode" }, { status: 501 });
  if (!rateLimit(clientKey(request, "change-password"), 10)) {
    return NextResponse.json({ error: "Too many attempts. Try again in a minute." }, { status: 429 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const newPassword = String(body.password ?? "");
  const problem = validatePasswordStrength(newPassword);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) {
    // Generic — never include password material in error messages.
    return NextResponse.json({ error: "Could not update the password." }, { status: 400 });
  }

  // must_change_password is an admin-authority field — clear it with the
  // service role rather than trusting the client session's RLS surface.
  const admin = createAdminClient();
  await admin
    .from("profiles")
    .update({ must_change_password: false, updated_at: new Date().toISOString() })
    .eq("id", user.id);

  const { data: profile } = await supabase
    .from("profiles")
    .select("profile_completed")
    .eq("id", user.id)
    .single();

  return NextResponse.json({ ok: true, next: profile?.profile_completed ? "/lunch" : "/profile/setup" });
}
