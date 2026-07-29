"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DEMO_MODE } from "@/lib/demo/flag";

const DEMO_USERS = [
  { id: "demo-alice", name: "Alice", emoji: "🌮" },
  { id: "demo-bob", name: "Bob", emoji: "🥗" },
  { id: "demo-charlie", name: "Charlie", emoji: "🍕" },
];

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function demoSignIn(userId: string) {
    document.cookie = `lunchmatch_demo_user=${userId}; path=/; max-age=86400`;
    router.push("/lunch");
    router.refresh();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier, password }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(body.error ?? "Invalid username/email or password.");
      return;
    }
    router.push(body.next ?? "/lunch");
    router.refresh();
  }

  return (
    <main className="bg-tinder flex min-h-screen flex-col items-center justify-between p-6 text-white">
      <div />

      <div className="w-full max-w-xs text-center">
        <div className="text-7xl drop-shadow-lg">🔥</div>
        <h1 className="mt-2 text-4xl font-extrabold tracking-tight drop-shadow">
          lunchmatch
        </h1>
        <p className="mt-1 text-sm font-medium text-white/85">
          Swipe right on lunch.
        </p>

        {DEMO_MODE ? (
          <div className="mt-10 space-y-3">
            <p className="text-xs font-bold uppercase tracking-widest text-white/70">
              Demo mode — pick a coworker
            </p>
            {DEMO_USERS.map((u) => (
              <button
                key={u.id}
                onClick={() => demoSignIn(u.id)}
                className="pill w-full border-2 border-white bg-transparent py-3 text-base text-white transition hover:bg-white hover:text-[var(--tinder-rose)]"
              >
                {u.emoji} Continue as {u.name}
              </button>
            ))}
            <p className="text-[11px] text-white/60">
              Configure Supabase to switch to real, admin-managed accounts.
            </p>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-10 space-y-3 text-left">
            <input
              required
              autoComplete="username"
              placeholder="Username or work email"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="w-full rounded-full border-2 border-white/70 bg-white/10 px-5 py-3 text-sm text-white placeholder-white/60 backdrop-blur focus:border-white focus:outline-none"
            />
            <input
              type="password"
              required
              autoComplete="current-password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-full border-2 border-white/70 bg-white/10 px-5 py-3 text-sm text-white placeholder-white/60 backdrop-blur focus:border-white focus:outline-none"
            />
            {error && (
              <p role="alert" className="rounded-lg bg-white/15 px-3 py-2 text-sm">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={busy}
              className="pill w-full bg-white py-3 text-base text-[var(--tinder-rose)] disabled:opacity-60"
            >
              {busy ? "…" : "Sign in"}
            </button>
            <p className="text-center text-[11px] text-white/70">
              Accounts are created by your administrator. First sign-in uses the temporary
              password you were given.
            </p>
          </form>
        )}
      </div>

      <p className="text-[11px] text-white/60">
        By tapping anything you agree lunch is at 12:30.
      </p>
    </main>
  );
}
