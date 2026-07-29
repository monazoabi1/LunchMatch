/**
 * "Potential clients" mode.
 *
 * Most people only ever see the lunch flow. One account additionally gets a
 * business-development deck of prospect companies, and is asked which mode to
 * continue with at sign-in.
 *
 * This is a UI affordance, not a security boundary: /clients is reachable by
 * anyone who types the URL. Nothing there is confidential — it's a public
 * prospect list — but don't put anything sensitive behind this flag without
 * adding a real server-side check.
 */
export const CLIENT_MODE_USERNAMES = ["itai.nadler"];

export const MODE_COOKIE = "lunchmatch_mode";
export type AppMode = "food" | "clients";

export function hasClientMode(username: string | undefined | null): boolean {
  if (!username) return false;
  return CLIENT_MODE_USERNAMES.includes(username.trim().toLowerCase());
}
