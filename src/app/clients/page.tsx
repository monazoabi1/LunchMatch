import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DEMO_MODE } from "@/lib/demo/flag";
import { getDemoUserId } from "@/lib/demo/auth";
import { demoGetUser } from "@/lib/demo/store";
import { CLIENTS } from "@/lib/clients";
import ClientDeck from "@/components/clients/ClientDeck";

export default async function ClientsPage() {
  let displayName = "";
  let avatar = "🙂";

  if (DEMO_MODE) {
    const userId = await getDemoUserId();
    const profile = userId ? demoGetUser(userId) : null;
    if (!profile) redirect("/login");
    displayName = profile.display_name;
    avatar = profile.avatar_emoji;
  } else {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, avatar_emoji")
      .eq("id", user.id)
      .single();
    displayName = profile?.display_name ?? "";
    avatar = profile?.avatar_emoji ?? "🙂";
  }

  const provided = CLIENTS.filter((c) => c.source === "provided").length;
  const ctech = CLIENTS.length - provided;

  return (
    <main className="mx-auto max-w-md pb-16">
      <header className="sticky top-0 z-40 mb-4 flex items-center justify-between border-b border-stone-200 bg-white px-4 py-3">
        <span
          title={displayName}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-stone-100 text-lg"
        >
          {avatar}
        </span>
        <div className="text-center leading-none">
          <span className="text-2xl font-extrabold tracking-tight">
            <span className="text-tinder">🏢 clientmatch</span>
          </span>
          <p className="mt-0.5 text-[11px] text-stone-400">
            {provided} target list · {ctech} from CTech 2026
          </p>
        </div>
        <Link
          href="/mode"
          title="Switch mode"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-stone-100 text-lg text-stone-500"
        >
          ⇄
        </Link>
      </header>

      <div className="px-4">
        <ClientDeck clients={CLIENTS} />
      </div>
    </main>
  );
}
