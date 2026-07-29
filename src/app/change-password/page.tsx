"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const REQUIREMENTS = [
  { re: /.{12,}/, label: "At least 12 characters" },
  { re: /[A-Z]/, label: "An uppercase letter" },
  { re: /[a-z]/, label: "A lowercase letter" },
  { re: /[0-9]/, label: "A number" },
  { re: /[^A-Za-z0-9]/, label: "A special character" },
];

export default function ChangePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const unmet = REQUIREMENTS.filter((r) => !r.re.test(password));
  const mismatch = confirm.length > 0 && confirm !== password;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (unmet.length > 0 || password !== confirm) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/account/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(body.error ?? "Could not update the password.");
      return;
    }
    router.push(body.next ?? "/profile/setup");
    router.refresh();
  }

  return (
    <main className="bg-tinder flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl bg-white p-7 shadow-xl">
        <div className="text-center text-4xl">🔥</div>
        <h1 className="mt-2 text-center text-xl font-extrabold">Welcome to LunchMatch.</h1>
        <p className="mt-1 text-center text-sm text-[var(--body)]">
          Your current password is temporary. Create a new password before continuing.
        </p>

        <form onSubmit={submit} className="mt-5 space-y-3">
          <label className="block text-sm">
            <span className="mb-1 block font-semibold text-[var(--body)]">New password</span>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              className="w-full rounded-lg border border-stone-200 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold text-[var(--body)]">
              Confirm new password
            </span>
            <input
              type="password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              className="w-full rounded-lg border border-stone-200 px-3 py-2"
            />
          </label>

          <ul className="space-y-1 text-xs">
            {REQUIREMENTS.map((r) => {
              const ok = r.re.test(password);
              return (
                <li key={r.label} className={ok ? "text-emerald-600" : "text-stone-400"}>
                  {ok ? "✓" : "○"} {r.label}
                </li>
              );
            })}
            {mismatch && <li className="text-[var(--nope)]">✕ Passwords do not match</li>}
          </ul>

          {error && <p className="text-sm text-[var(--nope)]">{error}</p>}

          <button
            disabled={busy || unmet.length > 0 || password !== confirm}
            className="pill bg-tinder w-full py-3 text-white shadow disabled:opacity-50"
          >
            {busy ? "…" : "Set new password"}
          </button>
        </form>
      </div>
    </main>
  );
}
