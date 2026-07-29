# LunchMatch — running the real app locally

The app auto-detects its mode at startup: **no `NEXT_PUBLIC_SUPABASE_URL` → demo mode**
(in-memory sample coworkers), **URL present → real mode** (admin-managed accounts, real
auth, real database). This machine is set up for **real mode** against a local Supabase
stack running in Docker — no cloud account, no signup, no secrets to protect.

---

## 1. Every time you want to work on it

```
1. Start Docker Desktop and wait for it to say "Engine running"
2. db.cmd start        (spins up Postgres + Auth + Studio; ~20s when images are cached)
3. dev.cmd             (starts Next.js on http://localhost:3000)
```

`db.cmd` and `dev.cmd` both put the portable Node and Supabase CLI on `PATH` themselves,
so nothing needs to be installed globally and nothing needs admin rights.

| What | Where |
|------|-------|
| The app | http://localhost:3000 |
| Supabase Studio (browse tables, run SQL) | http://127.0.0.1:54323 |
| Mailpit (any email the app "sends") | http://127.0.0.1:54324 |
| Supabase API | http://127.0.0.1:54321 |

`db.cmd stop` shuts the containers down; the database survives and comes back on the
next `db.cmd start`.

---

## 2. Test accounts currently in the database

> ⚠️ These are **test accounts** created during setup. Delete them from `/admin/users`
> before using this with real coworkers.

| Sign in as | Password | Role |
|------------|----------|------|
| `mona` | `LunchMatch!2026` | admin |
| `testco` | `Lunch!Match2026x` | user |
| `dana` | `Coworker!2026` | user |

Group **GSOC Lunch Crew**, invite code `E7FF24`. Sign-in accepts either the username or
the email address.

---

## 3. There is no signup page — this is deliberate

Accounts are created by an administrator only. A new coworker never registers
themselves; the flow is:

1. Admin opens `/admin/users` → **Create user** (full name, username, work email, team).
2. The server generates a CSPRNG temporary password and shows it **exactly once** —
   copy it and hand it over. It is never stored by the app or written to logs.
3. The coworker signs in with it and is forced through `/change-password`, then
   `/profile/setup`, where **they** enter their own dietary needs and allergies. Admins
   never fill those in on someone's behalf.
4. They join the group with the invite code, and the app is theirs.

Self-registration is blocked at the database layer too, not just by the absence of a UI:
`enable_signup = false` under `[auth]` in `supabase/config.toml`. Without it, anyone with
the public anon key could `POST /auth/v1/signup` and get a working account.

> **Careful:** set that flag under `[auth]`, *not* under `[auth.email]`. The `[auth.email]`
> one maps to `GOTRUE_EXTERNAL_EMAIL_ENABLED` and disables email **logins** as well as
> signups, which locks everyone out — including you. Its config comment is misleading.

---

## 4. Adding the first admin (already done, here for reference)

Only needed on a fresh database — every later account comes from `/admin/users`.

```
npm run bootstrap:admin -- --email you@company.com --username you --name "Your Name" --team Eng
```

Omit `--password` to get a generated one printed once. Re-running on an existing email
resets that account's password and re-promotes it, so it doubles as an
"I locked myself out" recovery hatch.

---

## 5. Starting the database over

```
db.cmd db reset
```

Drops everything and replays `supabase/schema.sql` (wired in as the seed via
`[db.seed] sql_paths` in `config.toml`, so the schema file stays the single source of
truth for both local and cloud). This wipes all accounts, so follow it with the
`bootstrap:admin` command above.

---

## 6. Moving to Supabase Cloud later

Nothing in the app code changes. On the Supabase dashboard:

1. Create a project, then **SQL Editor** → paste and run `supabase/schema.sql`.
2. **Authentication → Providers → Email** → turn **off** "Allow new users to sign up"
   (the cloud equivalent of §3), and turn **off** "Confirm email" so admin-created
   accounts can sign in without an inbox round-trip.
3. **Project Settings → API** → copy three values into `.env.local`, replacing the local
   ones: Project URL → `NEXT_PUBLIC_SUPABASE_URL`, `anon`/public →
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `service_role` → `SUPABASE_SERVICE_ROLE_KEY`.
4. Restart the dev server, then run `npm run bootstrap:admin` again to create your admin
   in the new database.

Unlike the local keys, a real project's `service_role` key is a genuine master credential:
server-only, never `NEXT_PUBLIC_`, never committed, never pasted into chat.

---

## 7. Enabling the AI humor

`ANTHROPIC_API_KEY` is intentionally blank, so the app uses its deterministic templated
copy derived from the score breakdown — the UI renders identically either way. Drop a real
`sk-ant-...` key into `.env.local` and restart to enable the single live Claude call at the
`collecting → voting` transition. `AI_DISABLED=1` forces the fallback back on.

---

## 8. What is installed on this machine

Nothing required admin rights; all three are removable by deleting the folder.

| Tool | Location |
|------|----------|
| Node.js v24.18.0 LTS (portable) | `%LOCALAPPDATA%\node` |
| Supabase CLI 2.110.0 | `%LOCALAPPDATA%\supabase-cli` |
| Docker Desktop | pre-existing |
