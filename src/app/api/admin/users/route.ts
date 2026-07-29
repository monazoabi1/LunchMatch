import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/guard";
import { generateTempPassword } from "@/lib/auth/password";
import { clientKey, rateLimit } from "@/lib/auth/rate-limit";
import { DEMO_MODE } from "@/lib/demo/flag";

const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{2,31}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// GET /api/admin/users — list accounts (admin only).
export async function GET() {
  if (DEMO_MODE) return NextResponse.json({ error: "not_available_in_demo" }, { status: 501 });

  const supabase = await createClient();
  const ctx = await requireAdmin(supabase);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 403 });

  // Admin RLS policy permits this select; falls back to service role if needed.
  const { data: users, error } = await supabase
    .from("profiles")
    .select(
      "id, username, full_name, email, team, role, account_status, must_change_password, profile_completed, created_at"
    )
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: "list_failed" }, { status: 500 });
  return NextResponse.json({ users });
}

// POST /api/admin/users — create a coworker account (admin only).
// Returns the generated temporary password EXACTLY ONCE; it is never stored
// in the application database (only Supabase Auth keeps its hash).
export async function POST(request: Request) {
  if (DEMO_MODE) return NextResponse.json({ error: "not_available_in_demo" }, { status: 501 });
  if (!rateLimit(clientKey(request, "admin-create"), 20)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const supabase = await createClient();
  const ctx = await requireAdmin(supabase);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const full_name = String(body.full_name ?? "").trim();
  const username = String(body.username ?? "").trim().toLowerCase();
  const email = String(body.email ?? "").trim().toLowerCase();
  const team = String(body.team ?? "").trim().slice(0, 80);
  const role = body.role === "admin" ? "admin" : "user";

  if (!full_name) return NextResponse.json({ error: "Full name is required." }, { status: 400 });
  if (!USERNAME_RE.test(username)) {
    return NextResponse.json(
      { error: "Username must be 3–32 chars: lowercase letters, numbers, dots, dashes, underscores." },
      { status: 400 }
    );
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Enter a valid work email." }, { status: 400 });
  }

  const admin = createAdminClient();

  // Uniqueness checks (also enforced by DB unique constraints).
  const { data: clash } = await admin
    .from("profiles")
    .select("id, username, email")
    .or(`username.eq.${username},email.eq.${email}`)
    .limit(1);
  if (clash && clash.length > 0) {
    const taken = clash[0].username === username ? "Username" : "Email";
    return NextResponse.json({ error: `${taken} is already in use.` }, { status: 409 });
  }

  const tempPassword = generateTempPassword();

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: {
      username,
      full_name,
      team,
      role,
      must_change_password: true,
    },
  });

  if (createError || !created.user) {
    // Generic message — never echo provider details or credentials.
    return NextResponse.json({ error: "Could not create the account." }, { status: 400 });
  }

  // The signup trigger created the profile; make the management fields
  // authoritative regardless of trigger behavior.
  await admin
    .from("profiles")
    .update({
      username,
      full_name,
      email,
      team,
      role,
      must_change_password: true,
      profile_completed: false,
      display_name: full_name || username,
      updated_at: new Date().toISOString(),
    })
    .eq("id", created.user.id);

  return NextResponse.json({
    ok: true,
    user: { id: created.user.id, username, email },
    // Shown once in the UI, never persisted by the app, never logged.
    temp_password: tempPassword,
  });
}
