"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Profile } from "@/types";

type ManagedUser = Pick<
  Profile,
  | "id"
  | "username"
  | "full_name"
  | "email"
  | "team"
  | "role"
  | "account_status"
  | "must_change_password"
  | "profile_completed"
  | "created_at"
>;

interface Credentials {
  username: string;
  password: string;
  context: string;
}

export default function AdminUsersClient({ adminName }: { adminName: string }) {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirm, setConfirm] = useState<{ text: string; run: () => Promise<void> } | null>(null);

  // Create form
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [team, setTeam] = useState("");
  const [role, setRole] = useState<"user" | "admin">("user");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users", { cache: "no-store" });
      if (res.ok) setUsers((await res.json()).users ?? []);
      else setNotice({ kind: "err", text: "Could not load users." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: fullName, username, email, team, role }),
      });
      const body = await res.json();
      if (!res.ok) {
        setNotice({ kind: "err", text: body.error ?? "Could not create the account." });
        return;
      }
      setCredentials({
        username: body.user.username,
        password: body.temp_password,
        context: "User created successfully.",
      });
      setCopied(false);
      setFullName("");
      setUsername("");
      setEmail("");
      setTeam("");
      setRole("user");
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function act(user: ManagedUser, action: string) {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const body = await res.json();
      if (!res.ok) {
        setNotice({ kind: "err", text: body.error ?? "Action failed." });
        return;
      }
      if (action === "reset_password" && body.temp_password) {
        setCredentials({
          username: body.username ?? user.username ?? "",
          password: body.temp_password,
          context: "Password reset. The user must change it at next sign-in.",
        });
        setCopied(false);
      } else {
        setNotice({ kind: "ok", text: "Done." });
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function removeUser(user: ManagedUser) {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, { method: "DELETE" });
      const body = await res.json();
      if (!res.ok) setNotice({ kind: "err", text: body.error ?? "Delete failed." });
      else setNotice({ kind: "ok", text: `Deleted ${user.username}.` });
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function copyCredentials() {
    if (!credentials) return;
    await navigator.clipboard.writeText(
      `LunchMatch sign-in\nUsername: ${credentials.username}\nTemporary password: ${credentials.password}\n(You'll be asked to change it on first sign-in.)`
    );
    setCopied(true);
  }

  return (
    <main className="mx-auto max-w-3xl p-4 pb-16">
      <header className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">
            <span className="text-tinder">🔥 lunchmatch</span>{" "}
            <span className="text-stone-400">/ admin</span>
          </h1>
          <p className="text-sm text-stone-500">User management · signed in as {adminName}</p>
        </div>
        <Link
          href="/lunch"
          className="rounded-full border border-stone-300 px-4 py-1.5 text-sm hover:bg-stone-100"
        >
          ← Back to app
        </Link>
      </header>

      {notice && (
        <div
          role="status"
          className={`mb-4 rounded-xl px-4 py-2 text-sm ${
            notice.kind === "ok"
              ? "bg-emerald-50 text-emerald-700"
              : "bg-red-50 text-[var(--nope)]"
          }`}
        >
          {notice.text}
        </div>
      )}

      {/* ── One-time credentials ── */}
      {credentials && (
        <div className="mb-5 rounded-2xl border-2 border-[var(--tinder-pink)] bg-pink-50 p-5">
          <p className="font-bold">{credentials.context}</p>
          <dl className="mt-2 font-mono text-sm">
            <div className="flex gap-2">
              <dt className="text-stone-500">Username:</dt>
              <dd className="font-bold">{credentials.username}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-stone-500">Temporary password:</dt>
              <dd className="font-bold">{credentials.password}</dd>
            </div>
          </dl>
          <p className="mt-2 text-xs text-stone-500">
            Copy these credentials now and hand them over privately. The temporary password
            will not be shown again.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={copyCredentials}
              className="pill bg-tinder px-5 py-2 text-sm text-white"
            >
              {copied ? "Copied ✓" : "Copy Credentials"}
            </button>
            <button
              onClick={() => setCredentials(null)}
              className="pill border border-stone-300 px-5 py-2 text-sm text-stone-600"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* ── Create form ── */}
      <form onSubmit={createUser} className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-xs font-bold uppercase tracking-widest text-stone-400">
          Create coworker account
        </h2>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block font-semibold text-[var(--body)]">Full name *</span>
            <input
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Mona Zoabi"
              className="w-full rounded-lg border border-stone-200 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold text-[var(--body)]">Username *</span>
            <input
              required
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
              pattern="[a-z0-9][a-z0-9._\-]{2,31}"
              title="3–32 chars: lowercase letters, numbers, dots, dashes, underscores"
              placeholder="mona.zoabi"
              className="w-full rounded-lg border border-stone-200 px-3 py-2 font-mono"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold text-[var(--body)]">Work email *</span>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="mona.zoabi@company.com"
              className="w-full rounded-lg border border-stone-200 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold text-[var(--body)]">Team / department</span>
            <input
              value={team}
              onChange={(e) => setTeam(e.target.value)}
              placeholder="Ocean"
              className="w-full rounded-lg border border-stone-200 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold text-[var(--body)]">Role</span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value === "admin" ? "admin" : "user")}
              className="w-full rounded-lg border border-stone-200 px-3 py-2"
            >
              <option value="user">User</option>
              <option value="admin">Administrator</option>
            </select>
          </label>
        </div>
        <button
          disabled={busy}
          className="pill bg-tinder mt-4 px-6 py-2.5 text-sm text-white shadow disabled:opacity-50"
        >
          {busy ? "…" : "Create Coworker"}
        </button>
        <p className="mt-2 text-xs text-stone-400">
          A secure temporary password is generated server-side and shown once. The coworker
          must change it on first sign-in, then fill in their own dietary details.
        </p>
      </form>

      {/* ── Users table ── */}
      <section className="mt-5 rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-xs font-bold uppercase tracking-widest text-stone-400">
          Existing users {loading && "· loading…"}
        </h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-stone-200 text-xs uppercase tracking-wide text-stone-400">
                <th className="py-2 pr-3">Name</th>
                <th className="py-2 pr-3">Username</th>
                <th className="py-2 pr-3">Email</th>
                <th className="py-2 pr-3">Team</th>
                <th className="py-2 pr-3">Role</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Pwd</th>
                <th className="py-2 pr-3">Profile</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-stone-100 align-top">
                  <td className="py-2 pr-3 font-semibold">{u.full_name || "—"}</td>
                  <td className="py-2 pr-3 font-mono">{u.username}</td>
                  <td className="py-2 pr-3">{u.email}</td>
                  <td className="py-2 pr-3">{u.team || "—"}</td>
                  <td className="py-2 pr-3">
                    <Badge tone={u.role === "admin" ? "pink" : "gray"}>{u.role}</Badge>
                  </td>
                  <td className="py-2 pr-3">
                    <Badge tone={u.account_status === "active" ? "green" : "red"}>
                      {u.account_status}
                    </Badge>
                  </td>
                  <td className="py-2 pr-3">{u.must_change_password ? "⏳ temp" : "✓"}</td>
                  <td className="py-2 pr-3">{u.profile_completed ? "✓" : "…"}</td>
                  <td className="py-2">
                    <div className="flex flex-wrap gap-1">
                      {u.account_status === "active" ? (
                        <Action
                          label="Disable"
                          onClick={() =>
                            setConfirm({
                              text: `Disable ${u.username}? They will lose access immediately.`,
                              run: () => act(u, "disable"),
                            })
                          }
                        />
                      ) : (
                        <Action label="Reactivate" onClick={() => act(u, "reactivate")} />
                      )}
                      <Action
                        label="Reset Password"
                        onClick={() =>
                          setConfirm({
                            text: `Reset ${u.username}'s password? Their current password stops working.`,
                            run: () => act(u, "reset_password"),
                          })
                        }
                      />
                      {u.role === "user" ? (
                        <Action label="Make admin" onClick={() => act(u, "promote")} />
                      ) : (
                        <Action label="Make user" onClick={() => act(u, "demote")} />
                      )}
                      <Action
                        label="Delete"
                        danger
                        onClick={() =>
                          setConfirm({
                            text: `Permanently delete ${u.username}? This cannot be undone.`,
                            run: () => removeUser(u),
                          })
                        }
                      />
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && users.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-6 text-center text-stone-400">
                    No users yet — create the first coworker above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Confirmation dialog ── */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <p className="text-sm">{confirm.text}</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setConfirm(null)}
                className="pill border border-stone-300 px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                disabled={busy}
                onClick={async () => {
                  const { run } = confirm;
                  setConfirm(null);
                  await run();
                }}
                className="pill bg-[var(--nope)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function Badge({ tone, children }: { tone: "pink" | "gray" | "green" | "red"; children: React.ReactNode }) {
  const classes = {
    pink: "bg-pink-100 text-[var(--tinder-pink)]",
    gray: "bg-stone-100 text-stone-600",
    green: "bg-emerald-100 text-emerald-700",
    red: "bg-red-100 text-[var(--nope)]",
  }[tone];
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${classes}`}>{children}</span>
  );
}

function Action({
  label,
  onClick,
  danger,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
        danger
          ? "border-[var(--nope)]/40 text-[var(--nope)] hover:bg-red-50"
          : "border-stone-300 text-stone-600 hover:bg-stone-100"
      }`}
    >
      {label}
    </button>
  );
}
