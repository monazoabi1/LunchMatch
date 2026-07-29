"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DIETARY_TAGS, type DietaryTag } from "@/types";

const AVATARS = ["🙂", "🌮", "🥗", "🍕", "🍔", "🍣", "🥙", "🍜", "🧆", "🥪", "🍩", "☕"];

export default function ProfileSetupPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [avatar, setAvatar] = useState("🙂");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [dietary, setDietary] = useState<DietaryTag[]>([]);
  const [allergies, setAllergies] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function toggle(tag: DietaryTag) {
    setDietary((list) =>
      list.includes(tag) ? list.filter((t) => t !== tag) : [...list, tag]
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/account/profile-setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        display_name: displayName,
        avatar_emoji: avatar,
        avatar_url: avatarUrl || null,
        dietary_restrictions: dietary,
        allergies,
      }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(body.error ?? "Could not save the profile.");
      return;
    }
    router.push(body.next ?? "/lunch");
    router.refresh();
  }

  return (
    <main className="bg-tinder flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl bg-white p-7 shadow-xl">
        <div className="text-center text-4xl">🔥</div>
        <h1 className="mt-2 text-center text-xl font-extrabold">Set up your profile</h1>
        <p className="mt-1 text-center text-sm text-[var(--body)]">
          Your dietary details are yours to declare — admins never fill these in for you.
        </p>

        <form onSubmit={submit} className="mt-5 space-y-4">
          <label className="block text-sm">
            <span className="mb-1 block font-semibold text-[var(--body)]">Display name *</span>
            <input
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="How teammates see you"
              className="w-full rounded-lg border border-stone-200 px-3 py-2"
            />
          </label>

          <div className="text-sm">
            <span className="mb-1 block font-semibold text-[var(--body)]">Avatar</span>
            <div className="flex flex-wrap gap-1.5">
              {AVATARS.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAvatar(a)}
                  className={`flex h-9 w-9 items-center justify-center rounded-full border text-lg ${
                    avatar === a
                      ? "border-[var(--tinder-pink)] bg-pink-50"
                      : "border-stone-200 bg-white"
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
            <input
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="Optional photo URL"
              className="mt-2 w-full rounded-lg border border-stone-200 px-3 py-2 text-xs"
            />
          </div>

          <div className="text-sm">
            <span className="mb-1 block font-semibold text-[var(--body)]">
              Dietary restrictions
            </span>
            <div className="flex flex-wrap gap-1.5">
              {DIETARY_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggle(tag)}
                  className={`pill border px-3 py-1 text-xs ${
                    dietary.includes(tag)
                      ? "bg-tinder border-transparent text-white"
                      : "border-stone-300 text-[var(--body)]"
                  }`}
                >
                  {tag.replaceAll("_", " ")}
                </button>
              ))}
            </div>
          </div>

          <label className="block text-sm">
            <span className="mb-1 block font-semibold text-[var(--body)]">
              Allergies & other food restrictions
            </span>
            <input
              value={allergies}
              onChange={(e) => setAllergies(e.target.value)}
              placeholder="e.g. peanuts, shellfish — leave empty if none"
              className="w-full rounded-lg border border-stone-200 px-3 py-2"
            />
          </label>

          {error && <p className="text-sm text-[var(--nope)]">{error}</p>}

          <button
            disabled={busy}
            className="pill bg-tinder w-full py-3 text-white shadow disabled:opacity-50"
          >
            {busy ? "…" : "Start matching 🔥"}
          </button>
        </form>
      </div>
    </main>
  );
}
