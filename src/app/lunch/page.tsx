import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLunchState } from "@/lib/queries/state";
import { DEMO_MODE } from "@/lib/demo/flag";
import { getDemoUserId } from "@/lib/demo/auth";
import { demoGetState } from "@/lib/demo/store";
import LunchClient from "@/components/lunch/LunchClient";

export default async function LunchPage() {
  if (DEMO_MODE) {
    const userId = await getDemoUserId();
    const state = userId ? demoGetState(userId) : null;
    if (!state) redirect("/login");
    return <LunchClient initialState={state} demo />;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const state = await getLunchState(supabase, user.id);
  if (!state) redirect("/login");
  if (!state.group) redirect("/group");

  return <LunchClient initialState={state} />;
}
