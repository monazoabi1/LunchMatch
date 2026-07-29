"use client";

import { useRouter } from "next/navigation";
import { MODE_COOKIE, type AppMode } from "@/lib/modes";

export default function ModePicker({ displayName }: { displayName: string }) {
  const router = useRouter();

  function choose(mode: AppMode) {
    document.cookie = `${MODE_COOKIE}=${mode}; path=/; max-age=86400`;
    router.push(mode === "clients" ? "/clients" : "/lunch");
    router.refresh();
  }

  return (
    <main className="bg-tinder flex min-h-screen flex-col items-center justify-center p-6 text-white">
      <div className="w-full max-w-sm text-center">
        <div className="text-6xl drop-shadow-lg">🔥</div>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight drop-shadow">
          Welcome back, {displayName.split(" ")[0]}
        </h1>
        <p className="mt-1 text-sm text-white/85">What are we swiping on today?</p>

        <div className="mt-8 space-y-3">
          <button
            onClick={() => choose("food")}
            className="w-full rounded-2xl bg-white p-5 text-left shadow-lg transition hover:brightness-95"
          >
            <div className="flex items-center gap-4">
              <span className="text-4xl">🍽️</span>
              <span>
                <span className="block text-lg font-extrabold text-[var(--ink)]">Food</span>
                <span className="block text-sm text-[var(--body)]">
                  Today&apos;s team lunch — preferences, swiping, the whole ritual.
                </span>
              </span>
            </div>
          </button>

          <button
            onClick={() => choose("clients")}
            className="w-full rounded-2xl bg-white p-5 text-left shadow-lg transition hover:brightness-95"
          >
            <div className="flex items-center gap-4">
              <span className="text-4xl">🏢</span>
              <span>
                <span className="block text-lg font-extrabold text-[var(--ink)]">
                  Potential clients
                </span>
                <span className="block text-sm text-[var(--body)]">
                  Swipe through prospect companies and build a shortlist.
                </span>
              </span>
            </div>
          </button>
        </div>

        <p className="mt-6 text-[11px] text-white/60">
          You can switch modes any time from the header.
        </p>
      </div>
    </main>
  );
}
