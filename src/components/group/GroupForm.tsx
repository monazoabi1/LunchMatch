"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function GroupForm({ displayName }: { displayName: string }) {
  const router = useRouter();
  const [groupName, setGroupName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function createGroup(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.rpc("create_group", { p_name: groupName });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/lunch");
    router.refresh();
  }

  async function joinGroup(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.rpc("join_group_by_code", { p_code: code });
    setBusy(false);
    if (error) {
      setError(
        error.message.includes("invalid_code")
          ? "That invite code doesn't match any group."
          : error.message
      );
      return;
    }
    router.push("/lunch");
    router.refresh();
  }

  return (
    <div className="w-full max-w-md space-y-5">
      <div className="text-center">
        <div className="text-5xl">🔥</div>
        <h1 className="mt-2 text-2xl font-extrabold">
          Hey {displayName}, find your crew
        </h1>
        <p className="text-sm text-stone-500">
          Join your team&apos;s lunch group, or start a new one.
        </p>
      </div>

      <form onSubmit={joinGroup} className="rounded-xl bg-white p-6 shadow-sm">
        <h2 className="text-xs font-bold uppercase tracking-widest text-stone-400">
          Join with an invite code
        </h2>
        <div className="mt-3 flex gap-2">
          <input
            required
            placeholder="e.g. TACO42"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            className="w-full rounded-full border border-stone-300 px-4 py-2.5 font-mono text-sm uppercase tracking-widest focus:border-[var(--tinder-pink)] focus:outline-none"
          />
          <button
            disabled={busy}
            className="pill bg-tinder px-6 py-2.5 text-sm text-white shadow disabled:opacity-50"
          >
            Join
          </button>
        </div>
      </form>

      <form onSubmit={createGroup} className="rounded-xl bg-white p-6 shadow-sm">
        <h2 className="text-xs font-bold uppercase tracking-widest text-stone-400">
          Create a new group
        </h2>
        <div className="mt-3 flex gap-2">
          <input
            required
            placeholder="Group name (e.g. Marketing Munchers)"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            className="w-full rounded-full border border-stone-300 px-4 py-2.5 text-sm focus:border-[var(--tinder-pink)] focus:outline-none"
          />
          <button
            disabled={busy}
            className="pill bg-[var(--ink)] px-5 py-2.5 text-sm text-white disabled:opacity-50"
          >
            Create
          </button>
        </div>
      </form>

      {error && <p className="text-center text-sm text-[var(--nope)]">{error}</p>}
    </div>
  );
}
