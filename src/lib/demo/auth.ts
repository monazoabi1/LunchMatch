import { cookies } from "next/headers";
import { demoGetUser } from "./store";

export const DEMO_COOKIE = "lunchmatch_demo_user";

/** Server-side: the current demo user id from the cookie, validated. */
export async function getDemoUserId(): Promise<string | null> {
  const store = await cookies();
  const id = store.get(DEMO_COOKIE)?.value;
  return demoGetUser(id ?? undefined)?.id ?? null;
}
