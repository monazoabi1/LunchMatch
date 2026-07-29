import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { DEMO_MODE } from "@/lib/demo/flag";

const DEMO_COOKIE = "lunchmatch_demo_user";

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isPublic =
    path.startsWith("/login") || path.startsWith("/auth") || path === "/favicon.ico";

  if (DEMO_MODE) {
    // No Supabase at all — a demo-user cookie is the whole auth story.
    if (!request.cookies.get(DEMO_COOKIE)?.value && !isPublic) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    // Everything except static assets and images.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
