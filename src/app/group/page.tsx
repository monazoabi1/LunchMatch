import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DEMO_MODE } from "@/lib/demo/flag";
import GroupForm from "@/components/group/GroupForm";

export default async function GroupPage() {
  // Demo users are pre-joined to the demo group.
  if (DEMO_MODE) redirect("/lunch");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("group_id, display_name")
    .eq("id", user.id)
    .single();

  if (profile?.group_id) redirect("/lunch");

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <GroupForm displayName={profile?.display_name ?? "friend"} />
    </main>
  );
}
