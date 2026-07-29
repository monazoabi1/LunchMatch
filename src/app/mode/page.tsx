import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DEMO_MODE } from "@/lib/demo/flag";
import { getDemoUserId } from "@/lib/demo/auth";
import { demoGetUser } from "@/lib/demo/store";
import { hasClientMode } from "@/lib/modes";
import ModePicker from "@/components/mode/ModePicker";

/**
 * The mode prompt. Only reachable by accounts that actually have the prospect
 * deck — everyone else is sent straight to lunch.
 */
export default async function ModePage() {
  let username: string | undefined;
  let displayName = "there";

  if (DEMO_MODE) {
    const userId = await getDemoUserId();
    const profile = userId ? demoGetUser(userId) : null;
    if (!profile) redirect("/login");
    username = profile.username;
    displayName = profile.display_name;
  } else {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");
    const { data: profile } = await supabase
      .from("profiles")
      .select("username, display_name")
      .eq("id", user.id)
      .single();
    username = profile?.username;
    displayName = profile?.display_name ?? "there";
  }

  if (!hasClientMode(username)) redirect("/lunch");

  return <ModePicker displayName={displayName} />;
}
