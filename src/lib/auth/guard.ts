import "server-only";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Profile } from "@/types";

export interface AuthContext {
  user: User;
  profile: Profile;
}

/** The caller's user + profile, or null when unauthenticated. */
export async function getAuthContext(supabase: SupabaseClient): Promise<AuthContext | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  if (!profile) return null;
  return { user, profile };
}

/**
 * Admin gate for API routes and pages. Enforced server-side (never just
 * hidden buttons): authenticated + role=admin + active account.
 */
export async function requireAdmin(supabase: SupabaseClient): Promise<AuthContext | null> {
  const ctx = await getAuthContext(supabase);
  if (!ctx) return null;
  if (ctx.profile.role !== "admin" || ctx.profile.account_status !== "active") return null;
  return ctx;
}
