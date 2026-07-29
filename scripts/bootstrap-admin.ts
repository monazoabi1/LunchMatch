/**
 * Bootstrap the first administrator.
 *
 * Every other account is created from /admin/users inside the app. This script
 * exists only for the chicken-and-egg first account, and replaces the manual
 * "run an UPDATE in the SQL editor" step. It is idempotent: run it again on an
 * existing email to re-promote or reset that account's password.
 *
 * Usage (Node 24 strips the TS types natively, so this runs unbuilt):
 *   node --env-file=.env.local scripts/bootstrap-admin.ts \
 *     --email you@company.com --username mona --name "Mona Zoabi" [--team Eng] [--password "..."]
 *
 * Omit --password and a CSPRNG temporary one is generated and printed once.
 * Uses the service-role key, so it must only ever be run from a trusted shell.
 */
import { parseArgs } from "node:util";
import { createClient } from "@supabase/supabase-js";
import { generateTempPassword, validatePasswordStrength } from "../src/lib/auth/password.ts";

// Mirrors the profiles.username CHECK constraint in supabase/schema.sql.
const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{2,31}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function fail(message: string): never {
  console.error(`\n  ✗ ${message}\n`);
  process.exit(1);
}

const { values } = parseArgs({
  options: {
    email: { type: "string" },
    username: { type: "string" },
    name: { type: "string", default: "" },
    team: { type: "string", default: "" },
    password: { type: "string" },
    // Skip the first-login profile setup. Off by default: an admin eats lunch
    // too, and the scoring engine needs their own dietary data, which only they
    // should enter.
    completed: { type: "boolean", default: false },
  },
});

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  fail(
    "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.\n" +
      "    Did you forget --env-file=.env.local ?"
  );
}

const email = (values.email ?? "").trim().toLowerCase();
const username = (values.username ?? "").trim().toLowerCase();
const fullName = (values.name ?? "").trim();
const team = (values.team ?? "").trim().slice(0, 80);

if (!EMAIL_RE.test(email)) fail("--email is required and must be a valid address.");
if (!USERNAME_RE.test(username)) {
  fail("--username must be 3–32 chars: lowercase letters, numbers, dots, dashes, underscores.");
}

let password = values.password;
let generated = false;
if (password) {
  const weak = validatePasswordStrength(password);
  if (weak) fail(`--password rejected: ${weak}`);
} else {
  password = generateTempPassword();
  generated = true;
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── Find an existing auth user with this email (makes the script idempotent) ──
async function findAuthUserByEmail(target: string): Promise<string | null> {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) fail(`Could not list users: ${error.message}`);
    const hit = data.users.find((u) => u.email?.toLowerCase() === target);
    if (hit) return hit.id;
    if (data.users.length < 200) return null;
  }
  return null;
}

const existingId = await findAuthUserByEmail(email);
let userId: string;

if (existingId) {
  userId = existingId;
  const { error } = await admin.auth.admin.updateUserById(userId, {
    password,
    email_confirm: true,
  });
  if (error) fail(`Could not update the existing account: ${error.message}`);
  console.log(`\n  → ${email} already existed; password reset and re-promoted.`);
} else {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // no inbox round-trip for the bootstrap account
    user_metadata: {
      username,
      full_name: fullName,
      team,
      role: "admin",
      must_change_password: false, // this password was chosen/seen by the operator
    },
  });
  if (error || !data.user) fail(`Could not create the account: ${error?.message ?? "unknown error"}`);
  userId = data.user.id;
}

// The handle_new_user trigger already inserted the profile row; make the
// management fields authoritative regardless of trigger behaviour, exactly as
// POST /api/admin/users does.
const { error: profileError } = await admin
  .from("profiles")
  .update({
    username,
    full_name: fullName,
    email,
    team,
    role: "admin",
    account_status: "active",
    must_change_password: false,
    profile_completed: values.completed,
    display_name: fullName || username,
    updated_at: new Date().toISOString(),
  })
  .eq("id", userId);

if (profileError) fail(`Account exists but promoting the profile failed: ${profileError.message}`);

const label = generated ? "temporary password (shown once)" : "password";
console.log(`
  ✓ Administrator ready.

    sign in with   ${username}   (or ${email})
    ${label}   ${password}

  Next: open the app, sign in, ${values.completed ? "" : "complete your profile, "}create a group,
  then add coworkers from /admin/users.
`);
