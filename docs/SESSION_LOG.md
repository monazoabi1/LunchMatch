# LunchMatch — Build Session Log

A condensed record of the Claude Code session that built LunchMatch, from empty repo to
working app. Written 2026-07-29.

---

## 1. What LunchMatch is

A hackathon MVP where coworkers submit lunch preferences, get **deterministically scored**
restaurant recommendations enriched with AI-written humor, **swipe Tinder-style** to vote,
and end up with a winner, per-restaurant lunch squads, and a joke award.

The core architectural idea: **the algorithm decides, the AI only writes copy.** Scoring is a
pure, testable function; Claude never computes, reorders, or mentions a score.

---

## 2. Session timeline

| # | Request | Outcome |
|---|---------|---------|
| 1 | Clone the repo | Cloned `monazoabi1/LunchMatch` to `C:\Claude\LunchMatch` |
| 2 | "Read the plan file and start implementing" | Found `LUNCH_MATCH_PLAN.md` on the `LunchMatch` branch; built the full MVP |
| 3 | "Fix the bugs and continue… copy Tinder's design" | Fixed 2 schema bugs + 3 UI/logic bugs; full Tinder redesign; built demo mode so the app runs with zero setup |
| 4 | Haifa restaurants, squads, allergies, desserts | 6 named restaurants + 2 dessert spots with photos; lunch-squad engine; allergies field |
| 5 | (mid-turn) "Suggest other restaurants near WeWork Haifa" | Researched downtown Haifa; proposed a numbered list |
| 6 | (mid-turn) Admin user management spec | Full admin account system: server-side creation, temp passwords, forced password change, profile setup |
| 7 | "Add all suggested + this table" | Catalog grew to **59 restaurants** (40+ real Haifa spots) |
| 8 | "Run the real app, keep adding photos" | Photos for all 37 new entries (43/59 have photos) |
| 9 | (mid-turn) "Add a tab to see what other people have chosen" | **Crew tab** — live view of everyone's prefs and votes |

---

## 3. What was built

### Scoring engine — `src/lib/scoring/`
Pure, synchronous, dependency-free functions:

- **`aggregate.ts`** — collapses everyone's preferences into one group input. Dietary needs
  union across *all* attendees (including maybes); the **strictest walker sets the ceiling**;
  budget is the attendee average; time window is the intersection of confirmed attendees.
- **`score.ts`** — scores each restaurant against the group. Dietary mismatch is a **hard
  filter** (−10, ineligible), not a preference. Deterministic sort: score desc → price asc →
  id asc. If the dietary filter eliminates *everything*, it falls back to the top-scored
  options and the UI shows "closest options" rather than crashing.
- **`award.ts`** — the "Difficult Coworker Award": counts how many restaurants satisfy each
  person's own constraints. **Dietary restrictions are deliberately excluded** from this
  computation — an award computed on allergy/religion/health data would be discriminatory.
  Suppressed entirely with fewer than 2 attendees.
- **`squads.ts`** — divides workers by restaurant. Voted → your pick; didn't vote but has
  preferences → your best personal match; silent → the #1 pick; "not today" → skipping list.

### AI enrichment — `src/lib/ai/`
- One Claude call, at the `collecting → voting` transition, **persisted and never regenerated**
  (so jokes don't change on refresh).
- Structured output via Zod schema (`client.messages.parse` + `zodOutputFormat`), model
  `claude-opus-4-8`, effort `low`.
- **Schema contains no numeric fields** — the AI physically cannot invent or restate a score.
- System prompt forbids joking about any person, their diet, religion, health, body, or income;
  humor targets the *decision-making process* only.
- **Deterministic fallback built day one** (`AI_DISABLED=1` forces it): templated copy derived
  from the score breakdown, rendering identically in the UI. Any failure — missing key, timeout,
  malformed output, wrong restaurant ids — silently falls back.

### UI — Tinder-styled
Design cues researched from public sources (brand gradient `#FD297B → #FF5864 → #FF655B`,
action-button colors, card overlay treatment, LIKE/NOPE stamps).

- **Login** — full-gradient welcome screen, flame logo, pill buttons
- **Preferences** — 10 fields incl. dietary tags and free-text allergies
- **Dashboard** — live aggregation: attendance, common window, average budget, cravings,
  dietary banner, ⚠️ allergies banner
- **Swipe deck** — draggable cards with rotation, LIKE/NOPE stamps that fade in with drag
  distance, real restaurant photos with emoji fallback, tap-to-flip **score receipt**,
  circular action buttons (rewind / nope / like / info), live tally
- **Crew tab** — who's submitted, what they're craving, ⚠️ allergies, and who swiped right
  on what; updates with the 3-second poll
- **Result** — "It's a Match!" gradient screen, lunch squads, dessert round, Difficult
  Coworker Award with an explicit note that dietary needs are excluded

### Admin user management
Implemented to spec for Supabase mode — **no fake or hardcoded users**:

- `POST /api/admin/users` — server-only creation. Validates unique username/email, generates a
  **CSPRNG** temp password (`crypto.randomInt`, never `Math.random`), returns it **once**.
- `PATCH /api/admin/users/[id]` — disable / reactivate / reset password / promote / demote
- `DELETE /api/admin/users/[id]` — permanent delete, confirmed in the UI
- `/admin/users` — create form, users table with status badges, confirmation dialogs,
  Copy Credentials button
- **First-login flow**: `/change-password` → `/profile/setup` → app. Users enter their *own*
  dietary details; admins never fill those in.
- **Login by username or email** — username→email resolved server-side; generic errors so
  usernames can't be enumerated; rate limited.
- Service-role key is server-only (`server-only` import guard), never `NEXT_PUBLIC_`.

### Demo mode
With no Supabase configured, the app runs entirely on an in-memory store (3 sample coworkers,
one group, seeded preferences). This is the plan's "L3 fallback" made permanent — the app is
always runnable. It disappears the moment real credentials exist.

---

## 4. Bugs found and fixed

| Bug | Where | Why it mattered |
|-----|-------|-----------------|
| **Circular foreign key** — `profiles` references `groups`, `groups` references `profiles` | `schema.sql` | The plan's SQL fails outright on first run. Fixed with a deferred `ALTER TABLE ADD CONSTRAINT`. |
| **RLS infinite recursion** — a policy on `profiles` that subqueries `profiles` | `schema.sql` | Exactly the Postgres error the plan warned about. Fixed with a `SECURITY DEFINER` `current_group_id()` helper. |
| **Fast swipes registered as taps** | `SwipeDeck.tsx` | `onPointerUp` read the drag delta from async React state, which lagged. Fixed with a synchronous ref. |
| **Client wrote directly to Supabase** | `PrefsForm.tsx` | Preferences bypassed the API layer and couldn't work in demo mode. Routed through `/api/prefs`. |
| **Port 3000 clash / wedged dev server** | `launch.json` | Two sessions competing for the port. Fixed with `autoPort` + a portable-Node launcher script. |

---

## 5. Data

**59 restaurants** in `data/restaurants.json`, 43 with photos. 40+ are real downtown-Haifa
places with walk times measured from **WeWork, Derech Ha'atzmaut 45**:

- **HaNamal street**: Breada, Fattoush Bar, Kona Burger, Lux, Crudo, Chang Ba, Libira,
  The Port 30, Malabeer, Raseef 33, ROLA, Wok N Roll, Neapolitan Pizza, Lululeesh, Kalman's
- **Derech Ha'atzmaut**: Nahma Hummus, Koreana, Butcher Bar, Chokolata, Little Italy,
  Mint Lounge Bar, Onyx
- **Natanzon / Palmer**: Venya Bistro, Ma'ayan HaBiera, Sugar Spice, Falafel Kikar Paris,
  Hummus BAR
- **Elsewhere downtown**: Iza Bar, Yakov Kebab, MOSAB HABESHA, Abu Yussef, Kimiko, Pita Baer,
  Star Restaurant, Abu Shakker, Yordi Café, Catom, Basel Burger, Manhattan American Diner,
  Shipudei Abu Al Waleed, Falafel Mishel, Bourekas Bachar HaAgala, Falafel HaZkenim

**Desserts** (`data/desserts.json`): ReBar, McDonald's Ice Cream.

> ⚠️ **Prices, hours and walk times are estimates.** Worth a 10-minute sanity pass by someone
> who actually eats at these places before the demo.

---

## 6. Verification

- **31/31 unit tests pass** (`npm test`) — scoring edge cases (empty group, all-`no` attendance,
  dietary filter eliminating everything, tie-break determinism, budget/walk boundaries), squad
  assignment rules, and password generation/strength.
- **`npx tsc --noEmit` clean.**
- **`npm run build` succeeds** — 21 routes, which is what catches the case-sensitive-import and
  Suspense-boundary bugs that only fail on Linux.
- **Full flow driven end-to-end in the browser**: login → preferences → scoring transition →
  swipes and vote changes from three users → "End the Democracy" → match screen, squads, award →
  reset. Also driven via the API directly to verify status-guarded transitions.

Not verified (needs a live Supabase project): the admin account-creation flow and the 12 auth
test scenarios. The code is written; it just can't be exercised without credentials.

---

## 7. Current state

- Branch `LunchMatch`, 4 commits ahead of origin
- App runs in **demo mode** (no `.env.local` yet)
- To switch to real mode: create a Supabase project, run `supabase/schema.sql`, turn off email
  confirmation, create `.env.local` with the three keys, then bootstrap the first admin:
  ```sql
  update profiles set role = 'admin', profile_completed = true where email = 'you@company.com';
  ```

---

## 8. Notable design decisions

- **Polling every 3s, not Supabase Realtime** — Realtime needs replication config, interacts
  badly with RLS (silently drops events), and fails invisibly.
- **Restaurants in JSON, not the database** — scoring stays a pure function; no seeding step;
  works even if Supabase is down.
- **Recommendations persisted as a snapshot** — result and vote screens become plain reads:
  instant, identical for every viewer, and they survive a later JSON edit or an AI outage.
- **One group per user via `profiles.group_id`**, not a join table — sidesteps the RLS
  recursion pitfall and makes "join a group" an idempotent `UPDATE`.
- **Sessions keyed by status, not date** — date-keyed sessions break across timezones.
- **Both state transitions are status-guarded** — a double-click, or two people clicking at
  once, is a harmless no-op rather than two different top-3 lists.
- **One vote per user enforced by the database** (`primary key (session_id, user_id)` + upsert)
  — no application logic can double-vote.
