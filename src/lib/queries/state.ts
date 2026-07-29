import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  DailyLunchSession,
  Group,
  LunchPreference,
  Profile,
  Recommendation,
  Vote,
} from "@/types";

export interface LunchState {
  profile: Profile;
  group: Group | null;
  members: Profile[];
  session: DailyLunchSession | null;
  prefs: LunchPreference[];
  recommendations: Recommendation[];
  votes: Vote[];
}

/**
 * One bundle with everything the lunch page needs — fetched server-side and
 * re-fetched by the 3s poll. All reads are plain RLS-checked selects; the
 * recommendation snapshot makes them instant and identical for all viewers.
 */
export async function getLunchState(
  supabase: SupabaseClient,
  userId: string
): Promise<LunchState | null> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  if (!profile) return null;

  const empty: LunchState = {
    profile,
    group: null,
    members: [],
    session: null,
    prefs: [],
    recommendations: [],
    votes: [],
  };
  if (!profile.group_id) return empty;

  const [{ data: group }, { data: members }] = await Promise.all([
    supabase.from("groups").select("*").eq("id", profile.group_id).single(),
    supabase.from("profiles").select("*").eq("group_id", profile.group_id),
  ]);

  // The open session if one exists, otherwise the most recently closed one
  // (so the result screen survives a refresh after "End the Democracy").
  const { data: sessions } = await supabase
    .from("daily_lunch_sessions")
    .select("*")
    .eq("group_id", profile.group_id)
    .order("session_date", { ascending: false });

  const session =
    sessions?.find((s: DailyLunchSession) => s.status !== "closed") ??
    sessions?.sort((a: DailyLunchSession, b: DailyLunchSession) =>
      (b.closed_at ?? "").localeCompare(a.closed_at ?? "")
    )[0] ??
    null;

  if (!session) return { ...empty, group: group ?? null, members: members ?? [] };

  const [{ data: prefs }, { data: recommendations }, { data: votes }] = await Promise.all([
    supabase.from("lunch_preferences").select("*").eq("session_id", session.id),
    supabase.from("recommendations").select("*").eq("session_id", session.id).order("rank"),
    supabase.from("votes").select("*").eq("session_id", session.id),
  ]);

  return {
    profile,
    group: group ?? null,
    members: members ?? [],
    session,
    prefs: prefs ?? [],
    recommendations: recommendations ?? [],
    votes: votes ?? [],
  };
}
