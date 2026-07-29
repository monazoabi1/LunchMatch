// Demo mode (fallback ladder L3): the app runs entirely on local fixtures —
// no Supabase project, no network. Active when explicitly forced OR when no
// Supabase URL is configured, so a bare `npm run dev` just works.
export const DEMO_MODE =
  process.env.NEXT_PUBLIC_DEMO_MODE === "1" ||
  !process.env.NEXT_PUBLIC_SUPABASE_URL;
