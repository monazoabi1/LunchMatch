"use client";

import { useState } from "react";
import type { LunchState } from "@/lib/queries/state";
import {
  DIETARY_TAGS,
  FOOD_CATEGORIES,
  TRANSPORT_MODES,
  type Attendance,
  type DietaryTag,
  type FoodCategory,
  type TransportMode,
} from "@/types";

export default function PrefsForm({
  state,
  onSaved,
}: {
  state: LunchState;
  onSaved: () => void;
}) {
  const mine = state.prefs.find((p) => p.user_id === state.profile.id);

  const [attendance, setAttendance] = useState<Attendance>(mine?.attendance ?? "yes");
  const [from, setFrom] = useState(mine?.available_from.slice(0, 5) ?? "12:00");
  const [to, setTo] = useState(mine?.available_to.slice(0, 5) ?? "13:00");
  const [budget, setBudget] = useState(Number(mine?.max_budget ?? 15));
  const [categories, setCategories] = useState<FoodCategory[]>(mine?.categories ?? []);
  const [dietary, setDietary] = useState<DietaryTag[]>(mine?.dietary ?? []);
  const [allergies, setAllergies] = useState(mine?.allergies ?? "");
  const [transport, setTransport] = useState<TransportMode>(mine?.transport ?? "walk");
  const [maxWalk, setMaxWalk] = useState(mine?.max_walking_minutes ?? 10);
  const [comment, setComment] = useState(mine?.comment ?? "");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle<T>(list: T[], setList: (v: T[]) => void, item: T) {
    setList(list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!state.session) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    const res = await fetch("/api/prefs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: state.session.id,
        attendance,
        available_from: from,
        available_to: to,
        max_budget: budget,
        categories,
        dietary,
        allergies,
        transport,
        max_walking_minutes: maxWalk,
        comment,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong");
      return;
    }
    setSaved(true);
    onSaved();
  }

  return (
    <form onSubmit={save} className="space-y-5 rounded-xl bg-white p-5 shadow-sm">
      <h2 className="text-xs font-bold uppercase tracking-widest text-stone-400">
        Your lunch profile
      </h2>

      <Field label="Are you in?">
        <div className="flex gap-2">
          {(["yes", "maybe", "no"] as const).map((a) => (
            <Pick key={a} active={attendance === a} onClick={() => setAttendance(a)}>
              {a === "yes" ? "✅ Yes" : a === "maybe" ? "🤔 Maybe" : "❌ Not today"}
            </Pick>
          ))}
        </div>
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Available from">
          <input
            type="time"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Until">
          <input
            type="time"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
          />
        </Field>
      </div>

      <Field label={`Max budget: $${budget}`}>
        <input
          type="range"
          min={5}
          max={40}
          value={budget}
          onChange={(e) => setBudget(Number(e.target.value))}
          className="w-full"
        />
      </Field>

      <Field label="Craving">
        <div className="flex flex-wrap gap-1.5">
          {FOOD_CATEGORIES.map((c) => (
            <Pick
              key={c}
              small
              active={categories.includes(c)}
              onClick={() => toggle(categories, setCategories, c)}
            >
              {c}
            </Pick>
          ))}
        </div>
      </Field>

      <Field label="Dietary needs">
        <div className="flex flex-wrap gap-1.5">
          {DIETARY_TAGS.map((d) => (
            <Pick
              key={d}
              small
              active={dietary.includes(d)}
              onClick={() => toggle(dietary, setDietary, d)}
            >
              {d.replaceAll("_", " ")}
            </Pick>
          ))}
        </div>
      </Field>

      <Field label="Allergies (free text — shown to the group)">
        <input
          value={allergies}
          onChange={(e) => setAllergies(e.target.value)}
          placeholder="e.g. peanuts, shellfish — leave empty if none"
          className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
        />
      </Field>

      <div className="grid grid-cols-1 gap-4 min-[360px]:grid-cols-2">
        <Field label="Getting there">
          <div className="flex gap-1.5">
            {TRANSPORT_MODES.map((t) => (
              <Pick key={t} small active={transport === t} onClick={() => setTransport(t)}>
                {t === "walk" ? "🚶" : t === "car" ? "🚗" : "🛵"} {t}
              </Pick>
            ))}
          </div>
        </Field>
        <Field label={`Max walk: ${maxWalk} min`}>
          <input
            type="range"
            min={2}
            max={30}
            value={maxWalk}
            onChange={(e) => setMaxWalk(Number(e.target.value))}
            className="w-full"
          />
        </Field>
      </div>

      <Field label="Anything else?">
        <input
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="e.g. it's my birthday, I demand dessert"
          className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
        />
      </Field>

      {error && <p className="text-sm text-[var(--nope)]">{error}</p>}
      <div className="flex items-center gap-3">
        <button
          disabled={busy}
          className="pill bg-tinder px-6 py-2.5 text-sm text-white shadow disabled:opacity-50"
        >
          {mine ? "Update profile" : "Save profile"}
        </button>
        {saved && <span className="text-sm font-semibold text-[var(--like)]">Saved ✓</span>}
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold text-[var(--body)]">{label}</label>
      {children}
    </div>
  );
}

function Pick({
  active,
  onClick,
  small,
  children,
}: {
  active: boolean;
  onClick: () => void;
  small?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`pill border transition ${
        small ? "px-3 py-1 text-xs" : "px-4 py-1.5 text-sm"
      } ${
        active
          ? "bg-tinder border-transparent text-white shadow"
          : "border-stone-300 bg-white text-[var(--body)] hover:border-stone-400"
      }`}
    >
      {children}
    </button>
  );
}
