import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { DEMO_MODE } from "@/lib/demo/flag";
import { DEMO_COOKIE } from "@/lib/demo/auth";
import { DEMO_PASSWORD, findDemoUser } from "@/lib/demo/users";
import { clientKey, rateLimit } from "@/lib/auth/rate-limit";
import { hasClientMode } from "@/lib/modes";

const GENERIC = "Unknown username or wrong password.";

function constantTimeEquals(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  // timingSafeEqual throws on length mismatch; compare lengths separately.
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * POST /api/demo/login — demo-mode sign-in with a username and the shared
 * demo password. Validation happens here so the password never reaches the
 * browser bundle. Not a security boundary: one password covers the whole
 * roster by design. Real per-user auth is the Supabase path.
 */
export async function POST(request: Request) {
  if (!DEMO_MODE) {
    return NextResponse.json({ error: "not_demo_mode" }, { status: 404 });
  }
  if (!rateLimit(clientKey(request, "demo-login"), 30)) {
    return NextResponse.json(
      { error: "Too many attempts. Try again in a minute." },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const identifier = String(body.identifier ?? "");
  const password = String(body.password ?? "");

  const user = findDemoUser(identifier);
  const passwordOk = constantTimeEquals(password, DEMO_PASSWORD);

  // Same error either way, so the roster can't be probed for valid usernames.
  if (!user || !passwordOk) {
    return NextResponse.json({ error: GENERIC }, { status: 401 });
  }

  // Accounts with the prospect deck get asked which mode to continue with.
  const response = NextResponse.json({
    ok: true,
    next: hasClientMode(user.username) ? "/mode" : "/lunch",
    user: { display_name: user.display_name, username: user.username },
  });
  response.cookies.set(DEMO_COOKIE, user.id, {
    path: "/",
    maxAge: 60 * 60 * 24,
    sameSite: "lax",
    httpOnly: false, // demo mode reads it client-side on sign-out
  });
  return response;
}
