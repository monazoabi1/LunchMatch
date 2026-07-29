import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { clientKey, rateLimit } from "@/lib/auth/rate-limit";
import { DEMO_MODE } from "@/lib/demo/flag";

const GENERIC = "Invalid username/email or password.";

/**
 * POST /api/auth/login — sign in with username OR work email.
 * Username → email resolution happens server-side only; the user directory is
 * never exposed to unauthenticated clients, and all failures return the same
 * generic error so usernames can't be enumerated.
 */
export async function POST(request: Request) {
  if (DEMO_MODE) return NextResponse.json({ error: "demo_mode" }, { status: 501 });
  if (!rateLimit(clientKey(request, "login"), 10)) {
    return NextResponse.json({ error: "Too many attempts. Try again in a minute." }, { status: 429 });
  }

  const body = await request.json().catch(() => ({}));
  const identifier = String(body.identifier ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  if (!identifier || !password) {
    return NextResponse.json({ error: GENERIC }, { status: 400 });
  }

  let email = identifier;
  if (!identifier.includes("@")) {
    // Server-side username → email resolution via the service role.
    try {
      const admin = createAdminClient();
      const { data } = await admin
        .from("profiles")
        .select("email")
        .eq("username", identifier)
        .single();
      if (!data?.email) return NextResponse.json({ error: GENERIC }, { status: 401 });
      email = data.email;
    } catch {
      return NextResponse.json({ error: GENERIC }, { status: 401 });
    }
  }

  const supabase = await createClient(); // cookie-bound: sets the session on success
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return NextResponse.json({ error: GENERIC }, { status: 401 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("account_status, must_change_password, profile_completed")
    .eq("id", user?.id ?? "")
    .single();

  // Routing priority (middleware enforces the same rules on every request).
  const next =
    profile?.account_status === "disabled"
      ? "/account-disabled"
      : profile?.must_change_password
        ? "/change-password"
        : !profile?.profile_completed
          ? "/profile/setup"
          : "/lunch";

  return NextResponse.json({ ok: true, next });
}
