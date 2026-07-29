import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: do not run code between createServerClient and getUser() —
  // a subtle bug in session refresh can log users out randomly otherwise.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const redirect = (pathname: string) => {
    const url = request.nextUrl.clone();
    url.pathname = pathname;
    return NextResponse.redirect(url);
  };

  // API routes do their own auth and must never receive HTML redirects.
  if (path.startsWith("/api")) return supabaseResponse;

  const isPublic =
    path.startsWith("/login") || path.startsWith("/auth") || path === "/favicon.ico";

  if (!user) {
    return isPublic ? supabaseResponse : redirect("/login");
  }

  // ── Routing priority (enforced on every request, not just at login) ──
  //  disabled → /account-disabled
  //  must_change_password → /change-password
  //  profile incomplete → /profile/setup
  //  /admin/* → admins only
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, account_status, must_change_password, profile_completed")
    .eq("id", user.id)
    .single();

  if (profile?.account_status === "disabled") {
    return path === "/account-disabled" ? supabaseResponse : redirect("/account-disabled");
  }
  if (profile?.must_change_password) {
    return path === "/change-password" ? supabaseResponse : redirect("/change-password");
  }
  if (profile && !profile.profile_completed) {
    return path === "/profile/setup" ? supabaseResponse : redirect("/profile/setup");
  }
  if (path.startsWith("/admin") && profile?.role !== "admin") {
    return redirect("/lunch");
  }
  if (path.startsWith("/login")) {
    return redirect("/lunch");
  }

  return supabaseResponse;
}
