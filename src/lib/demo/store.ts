import type {
  DailyLunchSession,
  Group,
  LunchPreference,
  Profile,
  Recommendation,
  Vote,
} from "@/types";
import type { LunchState } from "@/lib/queries/state";
import {
  DEMO_GROUP_ID,
  DEMO_GROUP_NAME,
  DEMO_INVITE_CODE,
  DEMO_USERS,
} from "./users";

// In-memory demo store — survives dev hot-reloads via globalThis.
// Mirrors exactly what the Supabase tables would hold.
// The roster itself lives in ./users.ts — edit that to change the crew.

export { DEMO_USERS };

const DEMO_GROUP: Group = {
  id: DEMO_GROUP_ID,
  name: DEMO_GROUP_NAME,
  invite_code: DEMO_INVITE_CODE,
  created_by: DEMO_USERS[0]?.id ?? "demo-user",
  created_at: new Date().toISOString(),
};

interface DemoDb {
  sessions: DailyLunchSession[];
  prefs: LunchPreference[];
  recommendations: Recommendation[];
  votes: Vote[];
  seq: number;
}

function freshSession(id: string): DailyLunchSession {
  return {
    id,
    group_id: DEMO_GROUP.id,
    session_date: new Date().toISOString().slice(0, 10),
    status: "collecting",
    meeting_point: "Office entrance",
    winner_recommendation_id: null,
    difficult_coworker_id: null,
    difficult_coworker_reason: null,
    closed_at: null,
  };
}

// Pre-filled preferences so the dashboard isn't empty on first load. Applied
// to whoever is 2nd and 3rd in the roster, so it survives any roster edit —
// the person signing in (usually the 1st) still fills in their own.
//
// Deliberately carries NO dietary tags and NO allergies. The roster holds real
// coworkers' names, and seeding a fabricated allergy or restriction against a
// real person is the kind of placeholder someone reads as fact. Everyone
// declares their own on the preferences form.
const SEED_PREFS: Omit<LunchPreference, "id" | "session_id" | "user_id" | "updated_at">[] = [
  {
    attendance: "yes",
    available_from: "12:15",
    available_to: "13:00",
    max_budget: 12,
    categories: ["salad", "bowls", "mexican"],
    dietary: [],
    allergies: "",
    transport: "walk",
    max_walking_minutes: 8,
    comment: "",
  },
  {
    attendance: "maybe",
    available_from: "12:00",
    available_to: "14:00",
    max_budget: 20,
    categories: ["pizza", "mexican", "asian"],
    dietary: [],
    allergies: "",
    transport: "walk",
    max_walking_minutes: 15,
    comment: "",
  },
];

function seed(): DemoDb {
  const session = freshSession("demo-session-1");
  const now = new Date().toISOString();
  return {
    sessions: [session],
    prefs: DEMO_USERS.slice(1, 1 + SEED_PREFS.length).map((user, i) => ({
      ...SEED_PREFS[i],
      id: `demo-pref-${user.id}`,
      session_id: session.id,
      user_id: user.id,
      updated_at: now,
    })),
    recommendations: [],
    votes: [],
    seq: 1,
  };
}

function db(): DemoDb {
  const g = globalThis as typeof globalThis & { __lunchmatch_demo?: DemoDb };
  if (!g.__lunchmatch_demo) g.__lunchmatch_demo = seed();
  return g.__lunchmatch_demo;
}

export function demoGetUser(userId: string | undefined): Profile | null {
  return DEMO_USERS.find((u) => u.id === userId) ?? null;
}

export function demoGetState(userId: string): LunchState | null {
  const profile = demoGetUser(userId);
  if (!profile) return null;
  const d = db();

  const session =
    d.sessions.find((s) => s.status !== "closed") ??
    [...d.sessions]
      .filter((s) => s.status === "closed")
      .sort((a, b) => (b.closed_at ?? "").localeCompare(a.closed_at ?? ""))[0] ??
    null;

  return {
    profile,
    group: DEMO_GROUP,
    members: DEMO_USERS,
    session,
    prefs: session ? d.prefs.filter((p) => p.session_id === session.id) : [],
    recommendations: session
      ? d.recommendations
          .filter((r) => r.session_id === session.id)
          .sort((a, b) => a.rank - b.rank)
      : [],
    votes: session ? d.votes.filter((v) => v.session_id === session.id) : [],
  };
}

export function demoGetPrefs(sessionId: string): LunchPreference[] {
  return db().prefs.filter((p) => p.session_id === sessionId);
}

export function demoUpsertPref(
  pref: Omit<LunchPreference, "id" | "updated_at">
): { error?: string } {
  const d = db();
  const session = d.sessions.find((s) => s.id === pref.session_id);
  if (!session) return { error: "no_session" };
  if (session.status !== "collecting") return { error: "voting_started" };

  const existing = d.prefs.find(
    (p) => p.session_id === pref.session_id && p.user_id === pref.user_id
  );
  if (existing) {
    Object.assign(existing, pref, { updated_at: new Date().toISOString() });
  } else {
    d.prefs.push({
      ...pref,
      id: `demo-pref-${++d.seq}`,
      updated_at: new Date().toISOString(),
    });
  }
  return {};
}

/** Atomic-enough for a single-process demo: claim the status transition. */
export function demoClaimTransition(
  sessionId: string,
  from: DailyLunchSession["status"],
  to: DailyLunchSession["status"]
): DailyLunchSession | null {
  const d = db();
  const session = d.sessions.find((s) => s.id === sessionId);
  if (!session || session.status !== from) return null;
  session.status = to;
  if (to === "closed") session.closed_at = new Date().toISOString();
  return session;
}

export function demoInsertRecommendations(
  recs: Omit<Recommendation, "id">[]
): Recommendation[] {
  const d = db();
  const withIds = recs.map((r) => ({ ...r, id: `demo-rec-${++d.seq}` }));
  d.recommendations.push(...withIds);
  return withIds;
}

export function demoUpsertVote(sessionId: string, userId: string, recommendationId: string): { error?: string } {
  const d = db();
  const session = d.sessions.find((s) => s.id === sessionId);
  if (!session) return { error: "no_session" };
  if (session.status !== "voting") return { error: "not_voting" };
  const existing = d.votes.find((v) => v.session_id === sessionId && v.user_id === userId);
  if (existing) existing.recommendation_id = recommendationId;
  else d.votes.push({ session_id: sessionId, user_id: userId, recommendation_id: recommendationId });
  return {};
}

export function demoCloseSession(
  sessionId: string,
  winnerRecommendationId: string,
  award: { user_id: string; reason: string } | null
): boolean {
  const session = demoClaimTransition(sessionId, "voting", "closed");
  if (!session) return false;
  session.winner_recommendation_id = winnerRecommendationId;
  session.difficult_coworker_id = award?.user_id ?? null;
  session.difficult_coworker_reason = award?.reason ?? null;
  return true;
}

export function demoNewSession(): DailyLunchSession {
  const d = db();
  for (const s of d.sessions) {
    if (s.status !== "closed") {
      s.status = "closed";
      s.closed_at = new Date().toISOString();
    }
  }
  const session = freshSession(`demo-session-${++d.seq}`);
  d.sessions.push(session);
  return session;
}
