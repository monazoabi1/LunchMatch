"use client";

import { useRef, useState } from "react";
import type { ClientCompany } from "@/types";

const SWIPE_THRESHOLD = 110;

// Deterministic per-company backdrop, so cards stay visually distinct even
// when a logo fails to load.
const BACKDROPS = [
  "linear-gradient(160deg,#1f2937,#4b5563)",
  "linear-gradient(160deg,#0f2027,#2c5364)",
  "linear-gradient(160deg,#232526,#414345)",
  "linear-gradient(160deg,#141e30,#243b55)",
  "linear-gradient(160deg,#2b1055,#7597de)",
  "linear-gradient(160deg,#42275a,#734b6d)",
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export default function ClientDeck({ clients }: { clients: ClientCompany[] }) {
  const [stack, setStack] = useState<string[]>(clients.map((c) => c.id));
  const [shortlist, setShortlist] = useState<string[]>([]);
  const [passed, setPassed] = useState<string[]>([]);
  const [drag, setDrag] = useState({ x: 0, y: 0, active: false });
  const [exiting, setExiting] = useState<{ id: string; dir: 1 | -1 } | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const delta = useRef({ x: 0, y: 0 });
  const moved = useRef(false);

  const ordered = stack
    .map((id) => clients.find((c) => c.id === id))
    .filter(Boolean) as ClientCompany[];
  const top = ordered[0];

  function flyOut(dir: 1 | -1) {
    if (!top || exiting) return;
    setExiting({ id: top.id, dir });
    if (dir === 1) setShortlist((s) => (s.includes(top.id) ? s : [...s, top.id]));
    else setPassed((p) => (p.includes(top.id) ? p : [...p, top.id]));
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
    delta.current = { x: 0, y: 0 };
    moved.current = false;
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
      setDrag({ x: 0, y: 0, active: false });
      return;
    }
    if (dx > SWIPE_THRESHOLD) flyOut(1);
    else if (dx < -SWIPE_THRESHOLD) flyOut(-1);
    else setDrag({ x: 0, y: 0, active: false });
  }

  const leadOpacity = Math.min(Math.max(drag.x / 100, 0), 1);
  const passOpacity = Math.min(Math.max(-drag.x / 100, 0), 1);
  const reviewed = shortlist.length + passed.length;

  return (
    <div className="mx-auto w-full max-w-sm select-none">
      {/* ── Card stack ── */}
      <div className="relative h-[440px]">
        {ordered.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-stone-300 p-6 text-center">
            <p className="text-4xl">🏁</p>
            <p className="mt-2 font-semibold text-stone-600">
              All {clients.length} companies reviewed
            </p>
            <p className="mt-1 text-sm text-stone-400">
              {shortlist.length} shortlisted · {passed.length} passed
            </p>
            <button
              onClick={() => {
                setStack(clients.map((c) => c.id));
                setShortlist([]);
                setPassed([]);
              }}
              className="pill bg-tinder mt-4 px-6 py-2 text-sm text-white"
            >
              Start over
            </button>
          </div>
        )}

        {ordered
          .slice(0, 3)
          .map((c, i) => {
            const isTop = i === 0;
            const isExiting = exiting?.id === c.id;
            const style: React.CSSProperties = isExiting
              ? {
                  transform: `translate(${exiting!.dir * 600}px, ${drag.y - 40}px) rotate(${exiting!.dir * 30}deg)`,
                  opacity: 0,
                  transition: "transform 0.32s ease-in, opacity 0.32s ease-in",
                  zIndex: 30,
                }
              : {
                  transform: isTop
                    ? `translate(${drag.x}px, ${drag.y * 0.2}px) rotate(${drag.x / 18}deg)`
                    : `scale(${1 - i * 0.04}) translateY(${i * 12}px)`,
                  transition: drag.active && isTop ? "none" : "transform 0.25s ease",
                  zIndex: 20 - i,
                };
            return (
              <ClientCard
                key={c.id}
                company={c}
                style={style}
                leadOpacity={isTop ? leadOpacity : 0}
                passOpacity={isTop ? passOpacity : 0}
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
          aria-label="Reset deck"
          onClick={() => {
            setStack(clients.map((c) => c.id));
            setShortlist([]);
            setPassed([]);
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
          aria-label="Add to shortlist"
          disabled={!top}
          onClick={() => flyOut(1)}
          className="action-btn h-16 w-16 text-2xl disabled:opacity-40"
          style={{ color: "var(--like)" }}
        >
          ★
        </button>
      </div>
      <p className="mt-2 text-center text-xs text-stone-400">
        Swipe right to shortlist · left to pass
        {ordered.length > 0 && ` · ${reviewed} of ${clients.length} reviewed`}
      </p>

      {/* ── Shortlist ── */}
      {shortlist.length > 0 && (
        <section className="mt-5 rounded-xl bg-white p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-widest text-stone-400">
            ★ Shortlist ({shortlist.length})
          </p>
          <div className="mt-2 space-y-1.5">
            {shortlist.map((id) => {
              const c = clients.find((x) => x.id === id);
              if (!c) return null;
              return (
                <div key={id} className="flex items-center justify-between text-sm">
                  <span className="font-semibold">{c.name}</span>
                  <span className="text-xs text-stone-400">{c.sector}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

function ClientCard({
  company,
  style,
  leadOpacity,
  passOpacity,
  handlers,
}: {
  company: ClientCompany;
  style: React.CSSProperties;
  leadOpacity: number;
  passOpacity: number;
  handlers: Partial<React.DOMAttributes<HTMLDivElement>>;
}) {
  const [logoFailed, setLogoFailed] = useState(false);
  const backdrop = BACKDROPS[hash(company.id) % BACKDROPS.length];

  return (
    <div
      {...handlers}
      className="absolute inset-0 touch-none overflow-hidden rounded-xl bg-white shadow-xl"
      style={{ ...style, cursor: "grab" }}
    >
      <div className="flex h-full flex-col" style={{ background: backdrop }}>
        <div className="stamp stamp-like z-10" style={{ opacity: leadOpacity }}>
          Lead
        </div>
        <div className="stamp stamp-nope z-10" style={{ opacity: passOpacity }}>
          Pass
        </div>

        {/* Logo plate — white so dark and light logos both stay legible */}
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="flex h-40 w-full items-center justify-center rounded-2xl bg-white p-6 shadow-inner">
            {company.logoUrl && !logoFailed ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={company.logoUrl}
                alt={`${company.name} logo`}
                draggable={false}
                className="max-h-full max-w-full object-contain"
                onError={() => setLogoFailed(true)}
              />
            ) : (
              <span className="text-5xl font-extrabold text-stone-300">
                {company.name.charAt(0)}
              </span>
            )}
          </div>
        </div>

        <div
          className="px-5 pb-5 pt-14 text-white"
          style={{ background: "linear-gradient(to top, rgba(0,0,0,0.8), transparent)" }}
        >
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-[22px] font-extrabold leading-tight">{company.name}</h3>
            <span className="shrink-0 rounded-full bg-white/25 px-2.5 py-1 text-xs font-bold backdrop-blur">
              {company.source === "ctech-2026" ? `CTech #${company.rank}` : "Target list"}
            </span>
          </div>
          <p className="mt-1 text-sm opacity-90">{company.sector}</p>
        </div>
      </div>
    </div>
  );
}
