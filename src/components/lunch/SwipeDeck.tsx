"use client";

import { useRef, useState } from "react";
import { getRestaurant } from "@/lib/restaurants";
import type { Profile, Recommendation, Vote } from "@/types";

// Card header gradients, picked deterministically per restaurant.
const CARD_GRADIENTS = [
  "linear-gradient(160deg,#3d155f,#df3f6e)",
  "linear-gradient(160deg,#0f2027,#2c5364)",
  "linear-gradient(160deg,#42275a,#734b6d)",
  "linear-gradient(160deg,#1d4350,#a43931)",
  "linear-gradient(160deg,#232526,#414345)",
  "linear-gradient(160deg,#141e30,#243b55)",
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const SWIPE_THRESHOLD = 110;

export default function SwipeDeck({
  recs,
  votes,
  members,
  myVote,
  onVote,
  disabled,
}: {
  recs: Recommendation[];
  votes: Vote[];
  members: Profile[];
  myVote?: string;
  onVote: (recommendationId: string) => void;
  disabled?: boolean;
}) {
  // Order of cards still in the deck (top card first).
  const [stack, setStack] = useState<string[]>(recs.map((r) => r.id));
  const [drag, setDrag] = useState({ x: 0, y: 0, active: false });
  const [exiting, setExiting] = useState<{ id: string; dir: 1 | -1 } | null>(null);
  const [flipped, setFlipped] = useState<string | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const moved = useRef(false);
  // Synchronous mirror of the drag delta — state lags behind fast swipes.
  const delta = useRef({ x: 0, y: 0 });

  const orderedRecs = stack
    .map((id) => recs.find((r) => r.id === id))
    .filter(Boolean) as Recommendation[];
  const top = orderedRecs[0];

  function flyOut(dir: 1 | -1) {
    if (!top || exiting) return;
    setExiting({ id: top.id, dir });
    if (dir === 1) onVote(top.id); // swipe right = your vote (upsert — last one wins)
    setTimeout(() => {
      setStack((s) => s.slice(1));
      setExiting(null);
      setDrag({ x: 0, y: 0, active: false });
    }, 320);
  }

  function onPointerDown(e: React.PointerEvent) {
    if (exiting) return;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    start.current = { x: e.clientX, y: e.clientY };
    moved.current = false;
    delta.current = { x: 0, y: 0 };
    setDrag({ x: 0, y: 0, active: true });
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!start.current || exiting) return;
    const dx = e.clientX - start.current.x;
    const dy = e.clientY - start.current.y;
    if (Math.abs(dx) + Math.abs(dy) > 6) moved.current = true;
    delta.current = { x: dx, y: dy };
    setDrag({ x: dx, y: dy, active: true });
  }
  function onPointerUp() {
    if (!start.current) return;
    const dx = delta.current.x;
    start.current = null;
    if (!moved.current) {
      // Tap = flip card for details (Tinder's ⓘ)
      if (top) setFlipped((f) => (f === top.id ? null : top.id));
      setDrag({ x: 0, y: 0, active: false });
      return;
    }
    if (dx > SWIPE_THRESHOLD && !disabled) flyOut(1);
    else if (dx < -SWIPE_THRESHOLD) flyOut(-1);
    else setDrag({ x: 0, y: 0, active: false });
  }

  const likeOpacity = Math.min(Math.max(drag.x / 100, 0), 1);
  const nopeOpacity = Math.min(Math.max(-drag.x / 100, 0), 1);

  return (
    <div className="mx-auto w-full max-w-sm select-none">
      {/* ── Card stack ── */}
      <div className="relative h-[480px]">
        {orderedRecs.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-stone-300 text-center">
            <p className="text-4xl">🔥</p>
            <p className="mt-2 font-semibold text-stone-500">Deck empty!</p>
            <p className="text-sm text-stone-400">
              Rewind to browse again, or end the democracy below.
            </p>
          </div>
        )}
        {orderedRecs
          .slice(0, 3)
          .map((rec, i) => {
            const isTop = i === 0;
            const isExiting = exiting?.id === rec.id;
            const x = isTop ? drag.x : 0;
            const rot = isTop ? drag.x / 18 : 0;
            const style: React.CSSProperties = isExiting
              ? {
                  transform: `translate(${exiting!.dir * 600}px, ${drag.y - 40}px) rotate(${exiting!.dir * 30}deg)`,
                  opacity: 0,
                  transition: "transform 0.32s ease-in, opacity 0.32s ease-in",
                  zIndex: 30,
                }
              : {
                  transform: isTop
                    ? `translate(${x}px, ${drag.y * 0.2}px) rotate(${rot}deg)`
                    : `scale(${1 - i * 0.04}) translateY(${i * 12}px)`,
                  transition: drag.active && isTop ? "none" : "transform 0.25s ease",
                  zIndex: 20 - i,
                };
            return (
              <Card
                key={rec.id}
                rec={rec}
                style={style}
                flipped={flipped === rec.id}
                likeOpacity={isTop ? likeOpacity : 0}
                nopeOpacity={isTop ? nopeOpacity : 0}
                handlers={
                  isTop
                    ? { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp }
                    : {}
                }
              />
            );
          })
          .reverse()}
      </div>

      {/* ── Action buttons ── */}
      <div className="mt-5 flex items-center justify-center gap-5">
        <button
          aria-label="Rewind deck"
          onClick={() => {
            setStack(recs.map((r) => r.id));
            setFlipped(null);
          }}
          className="action-btn h-12 w-12 text-xl"
          style={{ color: "var(--gold)" }}
        >
          ⟲
        </button>
        <button
          aria-label="Pass"
          disabled={!top}
          onClick={() => flyOut(-1)}
          className="action-btn h-16 w-16 text-2xl disabled:opacity-40"
          style={{ color: "var(--nope)" }}
        >
          ✕
        </button>
        <button
          aria-label="Vote for this one"
          disabled={!top || disabled}
          onClick={() => flyOut(1)}
          className="action-btn h-16 w-16 text-2xl disabled:opacity-40"
          style={{ color: "var(--like)" }}
        >
          ♥
        </button>
        <button
          aria-label="Card details"
          disabled={!top}
          onClick={() => top && setFlipped((f) => (f === top.id ? null : top.id))}
          className="action-btn h-12 w-12 text-lg disabled:opacity-40"
          style={{ color: "var(--sky)" }}
        >
          ⓘ
        </button>
      </div>
      <p className="mt-2 text-center text-xs text-stone-400">
        Swipe right (or ♥) to vote · swiping another card changes your vote
      </p>

      {/* ── Live tally ── */}
      <div className="mt-5 space-y-2">
        {recs.map((rec) => {
          const restaurant = getRestaurant(rec.restaurant_id);
          const voters = votes.filter((v) => v.recommendation_id === rec.id);
          const isMine = myVote === rec.id;
          return (
            <div
              key={rec.id}
              className={`flex items-center justify-between rounded-xl border bg-white px-3 py-2 text-sm ${
                isMine ? "border-[var(--like)]" : "border-stone-200"
              }`}
            >
              <span className="font-semibold">
                {restaurant?.emoji} {rec.restaurant_name}
                {isMine && <span className="ml-1 text-[var(--like)]">♥ your vote</span>}
              </span>
              <span className="flex items-center gap-1">
                {voters.map((v) => {
                  const m = members.find((mm) => mm.id === v.user_id);
                  return (
                    <span key={v.user_id} title={m?.display_name} className="text-base">
                      {m?.avatar_emoji}
                    </span>
                  );
                })}
                <span className="ml-1 rounded-full bg-stone-100 px-2 py-0.5 text-xs font-bold text-stone-600">
                  {voters.length}
                </span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Card({
  rec,
  style,
  flipped,
  likeOpacity,
  nopeOpacity,
  handlers,
}: {
  rec: Recommendation;
  style: React.CSSProperties;
  flipped: boolean;
  likeOpacity: number;
  nopeOpacity: number;
  handlers: Partial<React.DOMAttributes<HTMLDivElement>>;
}) {
  const restaurant = getRestaurant(rec.restaurant_id);
  const gradient = CARD_GRADIENTS[hash(rec.restaurant_id) % CARD_GRADIENTS.length];

  return (
    <div
      {...handlers}
      className="absolute inset-0 touch-none overflow-hidden rounded-xl bg-white shadow-xl"
      style={{ ...style, cursor: "grab" }}
    >
      {!flipped ? (
        <div className="relative flex h-full flex-col" style={{ background: gradient }}>
          {/* real photo when available; emoji shows through if it fails to load */}
          {restaurant?.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={restaurant.imageUrl}
              alt={restaurant.name}
              draggable={false}
              className="absolute inset-0 h-full w-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          )}

          {/* stamps */}
          <div className="stamp stamp-like z-10" style={{ opacity: likeOpacity }}>
            Like
          </div>
          <div className="stamp stamp-nope z-10" style={{ opacity: nopeOpacity }}>
            Nope
          </div>

          {/* emoji "photo" fallback layer */}
          <div className="flex flex-1 items-center justify-center">
            <span className="text-[120px] drop-shadow-lg">{restaurant?.emoji ?? "🍽️"}</span>
          </div>

          {/* bottom overlay — Tinder's clear-to-black gradient */}
          <div
            className="relative z-[5] px-5 pb-5 pt-16 text-white"
            style={{
              background: "linear-gradient(to top, rgba(0,0,0,0.78), transparent)",
            }}
          >
            <div className="flex items-end justify-between">
              <h3 className="text-[26px] font-extrabold leading-tight">
                {rec.restaurant_name}
                <span className="ml-2 text-xl font-medium opacity-80">
                  ${restaurant?.avgPrice}
                </span>
              </h3>
              <span className="rounded-full bg-white/25 px-2.5 py-1 text-sm font-bold backdrop-blur">
                {rec.score} pts
              </span>
            </div>
            <p className="mt-0.5 text-sm opacity-90">
              {restaurant?.categories.join(" · ")} · 🚶 {restaurant?.walkMinutes} min
            </p>
            {rec.ai_slogan && (
              <p className="mt-1 text-sm italic opacity-95">“{rec.ai_slogan}”</p>
            )}
          </div>
        </div>
      ) : (
        <div className="flex h-full flex-col bg-white p-5">
          <h3 className="text-xl font-extrabold">
            {restaurant?.emoji} {rec.restaurant_name}
          </h3>
          {rec.ai_why && <p className="mt-2 text-sm text-[var(--body)]">{rec.ai_why}</p>}
          <p className="mt-3 text-xs font-bold uppercase tracking-wide text-stone-400">
            Score receipt
          </p>
          <ul className="mt-1 flex-1 space-y-1.5 overflow-y-auto">
            {rec.score_breakdown.map((line, i) => (
              <li key={i} className="flex justify-between text-sm text-[var(--body)]">
                <span>{line.label}</span>
                <span
                  className="font-bold"
                  style={{ color: line.points >= 0 ? "var(--like)" : "var(--nope)" }}
                >
                  {line.points >= 0 ? `+${line.points}` : line.points}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-center text-xs text-stone-400">Tap card to flip back</p>
        </div>
      )}
    </div>
  );
}
