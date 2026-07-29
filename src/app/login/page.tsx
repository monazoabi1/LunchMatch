"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DEMO_MODE } from "@/lib/demo/flag";

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    // Demo mode validates against the shared roster password; real mode goes
    // through Supabase auth. Same form either way.
    const res = await fetch(DEMO_MODE ? "/api/demo/login" : "/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier, password }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(body.error ?? "Invalid username or password.");
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

        <form onSubmit={submit} className="mt-10 space-y-3 text-left">
          <input
            required
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            placeholder={DEMO_MODE ? "Username (e.g. mona.zoabi)" : "Username or work email"}
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
            {DEMO_MODE
              ? "Demo mode — your firstname.lastname and the shared team password."
              : "Accounts are created by your administrator. First sign-in uses the temporary password you were given."}
          </p>
        </form>
      </div>

      <p className="text-[11px] text-white/60">
        By tapping anything you agree lunch is at 12:30.
      </p>
    </main>
  );
}
