import type { Profile } from "@/types";

/**
 * The demo roster — single source of truth for who can sign in and who appears
 * inside the in-memory store.
 *
 * To change the crew, edit ROSTER only: one line per person. Usernames are
 * derived as first.last, ids from the username, so nothing else needs touching.
 *
 * ⚠️ DEMO MODE ONLY. Every account shares one password (DEMO_PASSWORD below) and
 * nothing is hashed or persisted — this is a stand-in for a real login so a demo
 * can be driven by name, not a security boundary. Real admin-managed accounts
 * with per-user credentials live in Supabase; see docs/LOCAL_SETUP.md.
 */
const ROSTER: string[] = [
  "Dana Sonin",
  "Fady Dahoud",
  "Itai Nadler",
  "Rawan Kartawy",
  "Tomer Sidis",
  "Malak Sabbah",
  "Guy Menahem",
  "Giana Hakim",
  "Marun Tanous",
  "Bashar Inshewat",
  "Yanni Tannas",
  "Muhammad Shalabi",
  "Yousef Ateek",
  "Sally Abukhalla",
  "Asaf Verdiger",
  "Mahmoud Zubidat",
  "Tal Alzami",
  "Sondos Khateb",
  "Sarit Tabachnik",
  "Julie Kaloush",
  "Guy Noy",
  "Salah Abbas",
  "Ward Abbas",
  "Wiaam Fares",
  "Yair Ross",
  "Yevgeni Yagoodin",
  "Mona Zoabi",
];

/** Shared demo password. Override with DEMO_PASSWORD in .env.local. */
export const DEMO_PASSWORD = process.env.DEMO_PASSWORD || "GsocLunch!2026";

export const DEMO_GROUP_ID = "demo-group";
export const DEMO_GROUP_NAME = "GSOC Lunch Crew";
export const DEMO_INVITE_CODE = "GSOC42";

// Avatars cycle so every card in the Crew tab is visually distinct.
const AVATARS = [
  "🌮", "🥗", "🍕", "🍔", "🍣", "🥙", "🍜", "🧆", "🥪", "🍩",
  "☕", "🌯", "🍲", "🥟", "🍛", "🥘", "🧇", "🍝", "🥐", "🍱",
  "🫓", "🥞", "🍚", "🥩", "🍤", "🧀", "🍰",
];

/** "Mona Zoabi" → "mona.zoabi" (ASCII-folded, deduped). */
function toUsername(name: string, taken: Set<string>): string {
  const base =
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "") // strip accents
      .trim()
      .replace(/[^a-z0-9]+/g, ".")
      .replace(/^\.|\.$/g, "") || "user";
  let username = base;
  for (let n = 2; taken.has(username); n++) username = `${base}${n}`;
  taken.add(username);
  return username;
}

const taken = new Set<string>();

export const DEMO_USERS: Profile[] = ROSTER.map((raw, i) => {
  // Title-case so a lowercase roster entry still displays properly.
  const display_name = raw
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  const username = toUsername(display_name, taken);
  return {
    id: `demo-${username}`,
    display_name,
    username,
    avatar_emoji: AVATARS[i % AVATARS.length],
    group_id: DEMO_GROUP_ID,
  };
});

/** Look up a roster member by username or display name (case-insensitive). */
export function findDemoUser(identifier: string): Profile | null {
  const needle = identifier.trim().toLowerCase();
  return (
    DEMO_USERS.find(
      (u) =>
        u.username === needle ||
        u.display_name.toLowerCase() === needle ||
        u.id === needle
    ) ?? null
  );
}
