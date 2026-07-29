# Lunch Match — 8-Hour Hackathon MVP Plan

## Context

Three devs, ~8 hours, greenfield repo (only `README.md` exists, no Node/npm installed, no git identity configured). Goal: a demo-ready app where coworkers submit lunch preferences, get deterministically-scored restaurant recommendations enriched with AI-generated humor, vote, and see a winner + a joke award — repeatable multiple times for judges.

Two research passes (an implementation-design pass and a risk/fallback pass) converged on one thing: **the biggest threats to this demo are not features, they're the environment and the integration seams.** Two blockers were verified directly on this machine and must be fixed before anyone writes app code:

1. **The user is not a local Administrator** — `winget install` needs elevation and will fail. Use the portable Node **zip**, not an installer.
2. **Git identity (`user.name`/`user.email`) is unset** at every scope — the first commit by each dev will fail outright until set.

Also verified: the repo lives inside a OneDrive-synced folder (`node_modules`/`.next` churn causes `EPERM`/`EBUSY` errors on Windows), `core.autocrlf=true` with no `.gitattributes` (CRLF turns every diff into a whole-file conflict), and `core.ignorecase=true` (a case-only import mismatch works on Windows and **breaks the Vercel Linux build** silently until the first production build is run).

This plan front-loads all of that in a 15-minute Hour 0, then builds the spine (prefs → scoring → AI → vote → result) before polishing auth, so the app is demoable end-to-end as early as possible.

---

## Locked-in decisions (opinionated, not open questions)

| Area | Decision | Why |
|---|---|---|
| Node install | **Portable zip** to `%LOCALAPPDATA%\node`, prepended to PATH | No admin rights available; `winget` will fail |
| Working folder | **Clone to `C:\dev\LunchMatch`**, abandon the OneDrive copy | OneDrive locks `node_modules`/`.next` on Windows; this is a 20-second fix, not a workaround to maintain |
| Auth | **Real Supabase Auth, email/password only.** Email confirmation turned OFF. 3 demo accounts pre-created hours ahead. | Real auth is cheap (~45 min, official `@supabase/ssr` files copied verbatim) and it's expected in a hackathon judged submission |
| Google OAuth | **Dropped.** Optional disabled "Sign in with Google (soon)" button for looks only, 2 minutes. | 30–60 min of console setup, redirect-URI matrix, and this machine may be on a managed tenant that can block unverified OAuth apps outright — zero demo value for the risk |
| One group per user | **`profiles.group_id` nullable column**, not a separate `group_members` join table | Avoids the classic Supabase RLS **infinite-recursion** pitfall entirely (a policy that subqueries its own table); makes "join a group" an idempotent `UPDATE` instead of a unique-constraint violation when someone re-joins mid-demo |
| RLS | **On from hour one**, trivial single-row `auth.uid()` policies + one `SECURITY DEFINER` RPC for invite-code join | "Harden RLS at the end" never happens in practice; an exposed table on a public anon key is a real finding a judge could hit |
| Restaurants | **`data/restaurants.json` only** — no DB table | Scoring becomes a pure, synchronous, dependency-free function; no seeding step to re-run on every reset; works even if Supabase is down |
| Recommendations | Persisted as a **snapshot** (restaurant name + score + breakdown + AI copy) on `recommendations`, computed once | Result/vote screens become plain reads — instant, identical for all viewers, survive a later JSON edit or an AI outage |
| AI call | **Anthropic Claude, structured output via Zod schema, called exactly once** at the `collecting → voting` transition, persisted, never regenerated | Regenerating per page load changes the jokes on refresh (looks broken), triples latency risk, and burns the one moment that must not fail live |
| AI fallback | `AI_DISABLED=1` flag → deterministic templated copy from the score breakdown, built **on day one**, indistinguishable in the UI | Makes the scariest live-demo dependency invisible if it fails |
| Voting | DB-enforced one-vote-per-user via `primary key (session_id, user_id)` + upsert | Zero application logic can double-vote; a double-click on stage is harmless |
| Live updates | **Polling every 3s + a manual "Refresh" button.** No Supabase Realtime. | Realtime needs replication config, interacts badly with RLS (silently drops events), and fails invisibly — the worst kind of bug to chase at hour 6 |
| Session keying | By **status**, not by calendar date | Date-keyed sessions break across timezones/devices; a `collecting`/`voting`/`closed` status with a partial unique index (`one open session per group`) sidesteps this class entirely |
| Editing after voting starts | Preferences stay in the DB and are technically frozen by RLS (`prefs_update` requires `status='collecting'`); UI just shows a "voting has started" read-only banner | The scoring snapshot is already taken; no race-condition handling needed beyond the existing RLS check |
| Deploy | Vercel, **first deploy by hour 2** (skeleton), `npm run build` run locally by hour 4 | Catches the case-sensitive-import and `useSearchParams`-needs-Suspense classes of bug while time remains to fix them |

---

## Hour 0 (0:00–0:20) — environment, all three devs, in parallel

1. **Git identity + hygiene** (every machine):
   ```
   git config --global user.name "Your Name"
   git config --global user.email "you@example.com"
   ```
2. **Node.js without admin rights**: download the Windows x64 **zip** (not the `.msi`) from nodejs.org, extract to `%LOCALAPPDATA%\node`, prepend that folder to `PATH` for the session (`$env:PATH = "$env:LOCALAPPDATA\node;$env:PATH"`). Verify `node -v` / `npm -v`. **Do not attempt `winget install` — it will fail without admin.** If this isn't working in 15 minutes, fall back to GitHub Codespaces on this repo (Node preinstalled, no admin needed).
3. **Move out of OneDrive**:
   ```
   git clone https://github.com/monazoabi1/LunchMatch.git C:/dev/LunchMatch
   ```
   Everyone works from `C:\dev\LunchMatch` from now on. The OneDrive copy is abandoned.
4. Dev A creates **one** Supabase project, posts the URL + anon key + DB password to the team chat immediately (all three point at the same project — do not let each dev create their own). Turns off **email confirmation** in Auth settings right away.
5. Dev B gets an Anthropic API key, verifies with one test call. Creates a Vercel account and connects the GitHub repo.
6. Dev C starts writing `data/restaurants.json` (see below) — pure data entry, no dependencies, useful work while Node installs.

---

## Repo structure

```
LunchMatch/
├─ .env.example                 # committed, no real secrets
├─ .gitignore                   # node_modules/, .next/, .env*.local, .vercel
├─ .gitattributes               # * text=auto eol=lf  (prevents CRLF conflict storms)
├─ next.config.ts               # ignore ESLint/TS build errors (hackathon-safe)
├─ middleware.ts                # Supabase session refresh
├─ data/
│  └─ restaurants.json          # ~16 restaurants — Dev C owns, quality-critical
├─ supabase/
│  ├─ schema.sql                # tables, RPCs, RLS — run once in SQL editor
│  └─ seed_demo.sql             # pre-baked demo group + prefs, for fallback/rehearsal
└─ src/
   ├─ types/index.ts            # SHARED CONTRACT — Dev A owns, edits requested in chat
   ├─ lib/
   │  ├─ supabase/{client,server}.ts, middleware.ts
   │  ├─ restaurants.ts         # load + validate JSON
   │  ├─ scoring/{aggregate,score,award}.ts   # pure functions, unit-testable
   │  ├─ ai/{schema,prompt,fallback}.ts
   │  └─ queries/{group,prefs,vote}.ts        # split per dev, avoids file conflicts
   ├─ components/{ui,auth,group,prefs,dashboard,recommend,vote,result}/
   └─ app/
      ├─ login/page.tsx
      ├─ auth/callback/route.ts
      ├─ group/page.tsx
      ├─ lunch/page.tsx         # phase router: Collecting / Voting / Closed
      └─ api/{recommend,vote,vote/close,ai/enrich,session}/route.ts
```

---

## Shared types (`src/types/index.ts`) — Dev A writes this first, commit #1

```ts
export type Uuid = string;
export type HHMM = string; // '12:30'

export const FOOD_CATEGORIES = ['pizza','sushi','burgers','salad','asian','mexican',
  'mediterranean','indian','bbq','sandwiches','soup','bowls'] as const;
export type FoodCategory = typeof FOOD_CATEGORIES[number];

export const DIETARY_TAGS = ['vegetarian','vegan','gluten_free','lactose_free','halal','kosher','nut_free'] as const;
export type DietaryTag = typeof DIETARY_TAGS[number];

export const TRANSPORT_MODES = ['walk','car','delivery'] as const;
export type TransportMode = typeof TRANSPORT_MODES[number];

export type Attendance = 'yes' | 'maybe' | 'no';
export type SessionStatus = 'collecting' | 'voting' | 'closed';

export interface Restaurant {
  id: string; name: string; emoji: string; description: string;
  categories: FoodCategory[]; avgPrice: number; dietary: DietaryTag[];
  walkMinutes: number; supportsDelivery: boolean; deliveryMinutes: number | null;
  opensAt: HHMM; closesAt: HHMM; rating?: number;
}

export interface Profile {
  id: Uuid; display_name: string; avatar_emoji: string; group_id: Uuid | null;
}

export interface Group { id: Uuid; name: string; invite_code: string; created_by: Uuid; created_at: string; }

export interface DailyLunchSession {
  id: Uuid; group_id: Uuid; session_date: string; status: SessionStatus;
  meeting_point: string; winner_recommendation_id: Uuid | null;
  difficult_coworker_id: Uuid | null; difficult_coworker_reason: string | null;
  closed_at: string | null;
}

export interface LunchPreference {
  id: Uuid; session_id: Uuid; user_id: Uuid; attendance: Attendance;
  available_from: HHMM; available_to: HHMM; max_budget: number;
  categories: FoodCategory[]; dietary: DietaryTag[]; transport: TransportMode;
  max_walking_minutes: number; comment: string; updated_at: string;
}

export interface ScoreLine { rule: string; points: number; label: string; }

export interface Recommendation {
  id: Uuid; session_id: Uuid; restaurant_id: string; restaurant_name: string;
  rank: 1|2|3; score: number; score_breakdown: ScoreLine[];
  ai_why: string | null; ai_slogan: string | null; ai_source: 'ai'|'fallback'|null;
}

export interface Vote { session_id: Uuid; user_id: Uuid; recommendation_id: Uuid; }

export interface GroupScoringInput {
  attendeeCount: number; yesCount: number; maybeCount: number; noCount: number;
  requiredDietary: DietaryTag[]; sharedCategories: FoodCategory[];
  budgetCap: number; groupTransport: TransportMode; maxWalkMinutes: number;
  commonWindow: { from: HHMM; to: HHMM } | null;
}
```

---

## Database (`supabase/schema.sql`)

```sql
create extension if not exists pgcrypto;

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_emoji text not null default '🙂',
  group_id uuid references groups(id) on delete set null
);

create table groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

create table daily_lunch_sessions (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  session_date date not null default (now()::date),
  status text not null default 'collecting' check (status in ('collecting','voting','closed')),
  meeting_point text not null default 'Office entrance',
  winner_recommendation_id uuid,
  difficult_coworker_id uuid references profiles(id),
  difficult_coworker_reason text,
  closed_at timestamptz
);
create unique index one_open_session_per_group on daily_lunch_sessions(group_id) where status <> 'closed';

create table lunch_preferences (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references daily_lunch_sessions(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  attendance text not null default 'yes' check (attendance in ('yes','maybe','no')),
  available_from time not null default '12:00',
  available_to time not null default '13:00',
  max_budget numeric(6,2) not null default 15,
  categories text[] not null default '{}',
  dietary text[] not null default '{}',
  transport text not null default 'walk' check (transport in ('walk','car','delivery')),
  max_walking_minutes int not null default 10,
  comment text not null default '',
  updated_at timestamptz not null default now(),
  unique (session_id, user_id)
);

create table recommendations (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references daily_lunch_sessions(id) on delete cascade,
  restaurant_id text not null,
  restaurant_name text not null,
  rank int not null check (rank between 1 and 3),
  score int not null,
  score_breakdown jsonb not null default '[]',
  ai_why text, ai_slogan text, ai_source text check (ai_source in ('ai','fallback')),
  unique (session_id, rank)
);
alter table daily_lunch_sessions
  add constraint dls_winner_fk foreign key (winner_recommendation_id) references recommendations(id);

create table votes (
  session_id uuid not null references daily_lunch_sessions(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  recommendation_id uuid not null references recommendations(id) on delete cascade,
  primary key (session_id, user_id)
);

-- ── RLS: simple, single-row checks only. profiles.group_id makes cross-table
-- ── recursion impossible — no group_members table means no self-referential policy.

alter table profiles enable row level security;
alter table groups enable row level security;
alter table daily_lunch_sessions enable row level security;
alter table lunch_preferences enable row level security;
alter table recommendations enable row level security;
alter table votes enable row level security;

create policy profiles_self on profiles for all to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_groupmates on profiles for select to authenticated
  using (group_id = (select group_id from profiles where id = auth.uid()));

create policy groups_member on groups for select to authenticated
  using (id = (select group_id from profiles where id = auth.uid()));

create policy sessions_member on daily_lunch_sessions for select to authenticated
  using (group_id = (select group_id from profiles where id = auth.uid()));
create policy sessions_write on daily_lunch_sessions for insert to authenticated
  with check (group_id = (select group_id from profiles where id = auth.uid()));
create policy sessions_update on daily_lunch_sessions for update to authenticated
  using (group_id = (select group_id from profiles where id = auth.uid()));

create policy prefs_select on lunch_preferences for select to authenticated
  using (session_id in (select id from daily_lunch_sessions where group_id =
    (select group_id from profiles where id = auth.uid())));
create policy prefs_write on lunch_preferences for insert to authenticated
  with check (user_id = auth.uid() and exists (
    select 1 from daily_lunch_sessions where id = session_id and status = 'collecting'));
create policy prefs_update on lunch_preferences for update to authenticated
  using (user_id = auth.uid() and exists (
    select 1 from daily_lunch_sessions where id = session_id and status = 'collecting'));

create policy recs_select on recommendations for select to authenticated
  using (session_id in (select id from daily_lunch_sessions where group_id =
    (select group_id from profiles where id = auth.uid())));

create policy votes_select on votes for select to authenticated
  using (session_id in (select id from daily_lunch_sessions where group_id =
    (select group_id from profiles where id = auth.uid())));
create policy votes_upsert on votes for insert to authenticated
  with check (user_id = auth.uid() and exists (
    select 1 from daily_lunch_sessions where id = session_id and status = 'voting'));
create policy votes_change on votes for update to authenticated
  using (user_id = auth.uid());

-- ── Invite-code join without leaking other groups' rows to the client.
create or replace function join_group_by_code(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_group uuid;
begin
  select id into v_group from groups where invite_code = upper(trim(p_code));
  if v_group is null then raise exception 'invalid_code'; end if;
  update profiles set group_id = v_group where id = auth.uid();
  insert into daily_lunch_sessions(group_id)
    select v_group where not exists (
      select 1 from daily_lunch_sessions where group_id = v_group and status <> 'closed');
  return v_group;
end; $$;

create or replace function create_group(p_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_code text;
begin
  for i in 1..8 loop
    v_code := upper(substr(md5(random()::text), 1, 6));
    exit when not exists (select 1 from groups where invite_code = v_code);
  end loop;
  insert into groups(name, invite_code, created_by) values (p_name, v_code, auth.uid()) returning id into v_id;
  update profiles set group_id = v_id where id = auth.uid();
  insert into daily_lunch_sessions(group_id) values (v_id);
  return v_id;
end; $$;

-- profile auto-creation on signup
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles(id, display_name) values (new.id, split_part(new.email,'@',1));
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();
```

Also commit `supabase/DISABLE_RLS.sql` (one `alter table ... disable row level security;` per table) as a break-glass fallback if RLS misbehaves live — using it is not failure, failing the demo is.

**Verify RLS in 5 minutes before moving on:** two accounts, two browser profiles; account B must get `[]` selecting `groups` before joining, and a clean `invalid_code` error from `join_group_by_code('WRONGX')`.

---

## Scoring (`src/lib/scoring/*`) — pure, synchronous, unit-testable

**Aggregation** (`aggregate.ts`): from all `lunch_preferences` for a session,
- `attendees` = prefs where `attendance != 'no'` (weight 1.0 for yes, 0.5 for maybe)
- `requiredDietary` = union of dietary tags over **all attendees including maybes** — hard filter
- `sharedCategories` = categories chosen by at least ~⅓ of weighted attendees
- `budgetCap` = average of attendees' `max_budget` (matches the dashboard's "average budget" display)
- `groupTransport` = most-selected transport mode (weighted)
- `maxWalkMinutes` = **minimum** across attendees (the strictest walker sets the ceiling)
- `commonWindow` = intersection of `[available_from, available_to]` over attendees with `attendance='yes'`

**Scoring one restaurant** (`score.ts`), exactly the rules from the spec:

```
if restaurant fails to satisfy every tag in requiredDietary:
    -10, mark ineligible (excluded from top 3 — hard filter, not a preference)
else: +3 (dietary_ok)

+3 if restaurant.categories ∩ sharedCategories is non-empty
+2 if restaurant.avgPrice <= budgetCap        else  -3 (over_budget)
+2 if restaurant matches groupTransport (walk: walkable; car: assume ok; delivery: supportsDelivery)
+2 if groupTransport==='walk' and restaurant.walkMinutes <= maxWalkMinutes   else -2 (over_walk, only when walking)
+1 if commonWindow overlaps [restaurant.opensAt, restaurant.closesAt]
```

Sort by `score` desc, tie-break by `avgPrice` asc then `id` asc (fully deterministic). Top 3 **eligible** restaurants win. **Edge case that must be handled explicitly:** if the dietary hard filter eliminates every restaurant, don't crash — fall back to the 3 highest-scored restaurants regardless of the filter and show "No restaurant satisfies every dietary need — closest options below." This will happen the first time realistic fake preferences are seeded, so build it deliberately rather than discover it live.

**Difficult Coworker Award** (`award.ts`): for each attendee, count how many restaurants in the full catalog satisfy *that person's own* budget/transport/walk/category/time constraints — **deliberately excluding their dietary restriction from this count**. The person with the lowest match count wins the award. Excluding dietary from the ranking is a hard rule, not a style choice: an award computed on allergy/religion/health data would be the "insulting/discriminatory" outcome the spec explicitly forbids. Reason string is chosen from whichever single constraint (budget/walk/time/category) eliminated the most restaurants for that person, mapped to a fixed harmless phrase (e.g. "held the line on the budget"). Suppress the award (return null) if fewer than 2 attendees.

---

## AI enrichment (`src/lib/ai/*`, `src/app/api/ai/enrich/route.ts`)

- **Client sends only `{ sessionId }`.** The route loads the top-3 recommendations and aggregated preferences server-side (RLS-checked), builds the prompt, and calls Claude. No prompt text or restaurant data ever originates client-side.
- **Key placement:** `ANTHROPIC_API_KEY` lives only in `.env.local` / Vercel env vars, never `NEXT_PUBLIC_`, referenced only inside this route + `lib/ai/*`.
- **Structured output, not prefill:** use the Anthropic SDK's schema-constrained output (Zod schema → `client.messages.parse()` / `zodOutputFormat`), not assistant-prefill tricks — current Opus/Sonnet models reject a prefilled `{` with a 400. This also eliminates markdown-fence/prose-preamble parsing failures at the API level.
- **Schema** (no numeric fields anywhere — the AI cannot invent or restate a score):
  ```ts
  const AiEnrichmentSchema = z.object({
    restaurants: z.array(z.object({
      restaurant_id: z.string(),
      why_it_fits: z.string().max(220),
      slogan: z.string().max(60),
    })).length(3),
    group_observation: z.string().max(180),
  });
  ```
- **System prompt rules:** copywriting only — never compute, mention, or reorder scores/rankings/percentages. Humor must target the *decision-making process* (indecision, the eternal 12:15-vs-12:30 debate), never a person, their diet, religion, health, body, or income.
- **Idempotent + one-shot:** called exactly once, from the same server action that transitions `collecting → voting`; if `recommendations[0].ai_why` is already set, skip the call and return the stored copy.
- **Fallback (built day one, `AI_DISABLED=1` to force it):** deterministic template built from the restaurant's own `score_breakdown` labels — e.g. `"Works for everyone's dietary needs · The group asked for sushi · 6 min walk"` — plus a stable-hashed slogan/observation from a small template bank. Renders identically to real AI copy; the demo survives an API outage invisibly.

---

## State machine

```
collecting → voting     (action: "Show us the options" — computes scoring snapshot + calls AI once, atomically)
voting     → closed     ("End the Democracy" — tallies votes, ties broken by stored score, persists award)
any state  → new session ("Start new lunch decision" — inserts a fresh `collecting` row; old session kept for history)
```

No `paused`/`draft`/`scoring` sub-states, no per-member status — member state (submitted? voted?) is derived from row existence, never stored redundantly. Both forward transitions are single atomic server actions guarded by `where status = 'X'`, so a double-click is a harmless no-op — this is also what prevents two people's simultaneous clicks from producing two different top-3 lists or a session stuck with a null AI payload.

---

## Task breakdown (after Hour 0)

**Dev A — foundation commit first (0:20–1:00), solo, then push before B/C touch app code:**
`create-next-app` (TS, Tailwind, App Router), `.gitignore`/`.gitattributes`, `.env.example`, `src/types/index.ts` (full), `data/restaurants.json` (3 stub entries so imports compile), Supabase client/server/middleware helpers, `schema.sql` applied + RLS verified, empty stub pages for every route B/C will own. Push. **Deploy the skeleton to Vercel immediately** (Hour 2 checkpoint pulled forward).

From here, all three work in parallel. Commit directly to `main`, `git pull --rebase` before every push, push every ~20–30 min. `types/index.ts`, `globals.css`, and `package.json` are Dev-A-only — others request changes in chat.

**Dev A (1:00–4:00):** login/signup pages (official `@supabase/ssr` pattern, copied verbatim — this is the auth-persistence risk area), auth callback route, middleware route guard, group create/join page + invite code UI, `app/lunch/page.tsx` phase router, "start new lunch decision" action.

**Dev B (0:20 stub data → 1:00; then 1:00–4:00):** finish `data/restaurants.json` to ~16 entries with deliberately varied prices/walk-times/dietary tags/hours (this file's quality determines the whole demo). Then: `lib/scoring/*` as pure functions + unit tests for the empty-dietary-filter edge case and tie-breaking; preference form (all 9 fields); group dashboard (attendance counts, common time, average budget, shared categories, dietary banner).

**Dev C (0:20–1:00 UI primitives; then 1:00–4:00):** `components/ui/*` + `globals.css`; `lib/ai/*` (schema, prompt, fallback) testable with no network; `api/ai/enrich/route.ts`; recommendation cards with score breakdown; voting UI + `api/vote/route.ts` (upsert) + `EndDemocracyButton` + `api/vote/close/route.ts` (tally, tie-break, award); result screen.

**Checkpoints (all-hands, no exceptions):**
- **Hour 2:** clickable end-to-end flow works, even with fake/stubbed data in places.
- **Hour 4:** everyone runs `npm run build` locally (not just `dev`) — catches case-sensitive imports and Suspense-boundary errors that only fail on Vercel's Linux build.
- **Hour 5:** full run-through on the deployed Vercel URL with 3 real accounts. Whatever's broken here is what gets cut.
- **Hour 6:** feature freeze. Bug-fix and polish only.
- **Hour 6.5:** build/verify "Start new lunch decision" works cleanly — this is also the demo's reset button; you'll need to demo the full flow 2–4 times.
- **Hour 7:** run `supabase/seed_demo.sql` to pre-populate a realistic group; rehearse the full script twice, out loud, on the actual demo network.
- **7:45–8:00:** buffer only. No new commits.

---

## Demo script + fallback ladder

1. Sign in (pre-created accounts) → join pre-seeded group `TACO42` → show one member submitting/editing preferences → dashboard aggregation.
2. Click "Show us the options" → explain the deterministic scoring receipt (score breakdown per restaurant) *before* revealing the AI wrote anything — this sequencing is the point of the whole architecture.
3. Show the AI-generated "why it fits" + slogan + group observation.
4. Vote from multiple accounts, change a vote live, watch the tally poll-update.
5. "End the Democracy" → result screen (winner, votes, departure time, who voted against).
6. Reveal the Difficult Coworker Award, and explicitly note dietary restrictions are excluded from that computation by design.
7. "Start new lunch decision" to reset for a repeat run.

**Fallback ladder** (rehearse level 1 and 2 specifically):
- **L1 — AI fails/times out/malformed:** invisible; the deterministic fallback copy renders identically. Say nothing unless asked.
- **L2 — Supabase flaky:** switch to a second pre-baked group already sitting in `voting` status with recommendations + AI copy persisted; demo vote→close→result→award only.
- **L3 — No internet/Supabase fully down:** a `NEXT_PUBLIC_DEMO_MODE` build reading local fixtures instead of Supabase, runnable via `npm run dev` with wifi off.
- **L4 — Hardware/projector failure:** a pre-recorded screen capture of the full happy path.

---

## Verification

- `npm run build` succeeds (not just `npm run dev`) before every deploy.
- RLS manual test with two accounts as described above.
- `vitest` unit tests on `lib/scoring/*` covering: empty group, all-`no` attendance, dietary filter eliminating every restaurant, tie-break determinism, budget/walk-time edge cases.
- Full manual run-through with 3 browser profiles/accounts on both localhost and the deployed Vercel URL.
- Confirm session persists after a hard refresh (the auth risk area) in a non-incognito browser window.
