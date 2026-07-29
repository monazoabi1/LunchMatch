/**
 * Bulk-create coworker accounts from a roster of full names.
 *
 * This is the same thing the admin "Create user" form does, in a loop: accounts
 * are created server-side with the service role, never self-registered. Reads
 * names from a file so the roster itself never has to live in the repo.
 *
 *   node --env-file=.env.local scripts/create-users.ts --file roster.txt --password "..." [flags]
 *
 * Flags:
 *   --file <path>       one full name per line; blank lines and # comments ignored
 *   --password <pw>     the shared initial password (required unless --dry-run)
 *   --domain <domain>   email domain, default gsoc.solutions
 *   --team <team>       team label for every created account, default ""
 *   --no-force-change   let people keep the shared password instead of being
 *                       forced to pick their own on first login
 *   --dry-run           print the username/email mapping and exit, touching nothing
 *
 * Idempotent: a name whose username or email already exists is reported as
 * "skipped", never overwritten, so re-running after adding names is safe.
 */
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { createClient } from "@supabase/supabase-js";

const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{2,31}$/;

function fail(message: string): never {
  console.error(`\n  ✗ ${message}\n`);
  process.exit(1);
}

const { values } = parseArgs({
  options: {
    file: { type: "string" },
    password: { type: "string" },
    domain: { type: "string", default: "gsoc.solutions" },
    team: { type: "string", default: "" },
    "no-force-change": { type: "boolean", default: false },
    "dry-run": { type: "boolean", default: false },
  },
});

const dryRun = values["dry-run"];
const forceChange = !values["no-force-change"];

if (!values.file) fail("--file is required (one full name per line).");
if (!dryRun && !values.password) fail("--password is required (or pass --dry-run).");

// ── roster ──
const names = readFileSync(values.file, "utf8")
  .split(/\r?\n/)
  .map((l) => l.trim())
  .filter((l) => l.length > 0 && !l.startsWith("#"));

if (names.length === 0) fail(`No names found in ${values.file}.`);

/** "sondos khateb" -> "Sondos Khateb"; leaves already-capitalised names alone. */
function titleCase(name: string): string {
  return name
    .split(/\s+/)
    .map((w) =>
      w.includes("-")
        ? w.split("-").map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join("-")
        : w.charAt(0).toUpperCase() + w.slice(1)
    )
    .join(" ");
}

/** first.last, stripped of diacritics and anything the username CHECK rejects. */
function toUsername(name: string): string {
  const parts = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // drop combining accents
    .toLowerCase()
    .replace(/['’]/g, "")
    .split(/\s+/)
    .map((p) => p.replace(/[^a-z0-9]/g, ""))
    .filter(Boolean);

  if (parts.length === 0) return "";
  // Middle names are dropped: first + last is what people will actually type.
  const base = parts.length === 1 ? parts[0] : `${parts[0]}.${parts[parts.length - 1]}`;
  return base.slice(0, 32);
}

type Row = {
  fullName: string;
  username: string;
  email: string;
  status: "pending" | "created" | "skipped" | "failed";
  note: string;
};

const rows: Row[] = [];
const seen = new Set<string>();

for (const raw of names) {
  const fullName = titleCase(raw);
  let username = toUsername(raw);
  let note = "";

  if (!USERNAME_RE.test(username)) {
    // Too short (e.g. a 2-letter single name) — pad rather than silently skip.
    const padded = (username + "..").slice(0, 32);
    if (USERNAME_RE.test(padded)) {
      username = padded;
    } else {
      rows.push({ fullName, username, email: "", status: "failed", note: "cannot derive a valid username" });
      continue;
    }
  }

  // Local collisions (two people sharing first+last) get a numeric suffix.
  if (seen.has(username)) {
    let n = 2;
    while (seen.has(`${username}${n}`)) n++;
    note = `collided with an earlier name, suffixed`;
    username = `${username}${n}`;
  }
  seen.add(username);

  rows.push({
    fullName,
    username,
    email: `${username}@${values.domain}`,
    status: "pending",
    note,
  });
}

// ── report the mapping first, always ──
const w = Math.max(...rows.map((r) => r.fullName.length), 12);
console.log(`\n  ${"Employee".padEnd(w)}  ${"Username".padEnd(22)}  Email`);
console.log(`  ${"-".repeat(w)}  ${"-".repeat(22)}  ${"-".repeat(34)}`);
for (const r of rows) {
  console.log(`  ${r.fullName.padEnd(w)}  ${r.username.padEnd(22)}  ${r.email}${r.note ? `   (${r.note})` : ""}`);
}
console.log(`\n  ${rows.length} names, force password change on first login: ${forceChange}`);

if (dryRun) {
  console.log("\n  --dry-run: nothing was created.\n");
  process.exit(0);
}

// ── create ──
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  fail("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set. Missing --env-file=.env.local ?");
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

console.log("");
for (const r of rows) {
  if (r.status === "failed") {
    console.log(`  ✗ ${r.fullName} — ${r.note}`);
    continue;
  }

  const { data: clash } = await admin
    .from("profiles")
    .select("id")
    .or(`username.eq.${r.username},email.eq.${r.email}`)
    .limit(1);
  if (clash && clash.length > 0) {
    r.status = "skipped";
    r.note = "username or email already exists";
    console.log(`  – ${r.username.padEnd(22)} already exists, left untouched`);
    continue;
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: r.email,
    password: values.password,
    email_confirm: true, // admin-created: no inbox round-trip
    user_metadata: {
      username: r.username,
      full_name: r.fullName,
      team: values.team,
      role: "user",
      must_change_password: forceChange,
    },
  });

  if (error || !data.user) {
    r.status = "failed";
    r.note = error?.message ?? "unknown error";
    console.log(`  ✗ ${r.username.padEnd(22)} ${r.note}`);
    continue;
  }

  // handle_new_user already inserted the profile; make the management fields
  // authoritative regardless of trigger behaviour (same as POST /api/admin/users).
  const { error: profileError } = await admin
    .from("profiles")
    .update({
      username: r.username,
      full_name: r.fullName,
      email: r.email,
      team: values.team,
      role: "user",
      account_status: "active",
      must_change_password: forceChange,
      profile_completed: false,
      display_name: r.fullName,
      updated_at: new Date().toISOString(),
    })
    .eq("id", data.user.id);

  if (profileError) {
    r.status = "failed";
    r.note = `created but profile update failed: ${profileError.message}`;
    console.log(`  ✗ ${r.username.padEnd(22)} ${r.note}`);
    continue;
  }

  r.status = "created";
  console.log(`  ✓ ${r.username.padEnd(22)} ${r.fullName}`);
}

const created = rows.filter((r) => r.status === "created").length;
const skipped = rows.filter((r) => r.status === "skipped").length;
const failed = rows.filter((r) => r.status === "failed").length;

console.log(`
  ${created} created, ${skipped} skipped, ${failed} failed.

  Everyone signs in at /login with their username (or email) and the shared
  password.${forceChange ? " They are then forced to choose their own password, and to fill\n  in their own dietary needs and allergies — nobody does that on their behalf." : ""}
`);
if (failed > 0) process.exitCode = 1;
