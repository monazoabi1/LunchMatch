import { randomInt } from "node:crypto";

const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWER = "abcdefghjkmnpqrstuvwxyz";
const DIGITS = "23456789";
const SPECIAL = "!@#$%^&*?-_+=";
const ALL = UPPER + LOWER + DIGITS + SPECIAL;

/**
 * Cryptographically secure temporary password: 14 chars, guaranteed to
 * contain upper, lower, digit and special characters. Uses crypto.randomInt
 * (CSPRNG) — never Math.random(). Ambiguous glyphs (I/l/O/0/1) are excluded
 * so credentials survive being read out loud.
 */
export function generateTempPassword(length = 14): string {
  if (length < 12) length = 12;
  const pick = (pool: string) => pool[randomInt(pool.length)];

  const chars = [pick(UPPER), pick(LOWER), pick(DIGITS), pick(SPECIAL)];
  while (chars.length < length) chars.push(pick(ALL));

  // Fisher–Yates with CSPRNG so the guaranteed classes aren't positionally predictable.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

/** Server-side strength check for user-chosen passwords. */
export function validatePasswordStrength(password: string): string | null {
  if (password.length < 12) return "Password must be at least 12 characters.";
  if (!/[A-Z]/.test(password)) return "Password must contain an uppercase letter.";
  if (!/[a-z]/.test(password)) return "Password must contain a lowercase letter.";
  if (!/[0-9]/.test(password)) return "Password must contain a number.";
  if (!/[^A-Za-z0-9]/.test(password)) return "Password must contain a special character.";
  return null;
}
