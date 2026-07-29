import type { ClientCompany } from "@/types";
import raw from "../../data/clients.json";

/**
 * Potential-client prospect list. Two sources:
 *  - "provided"   — the in-house target list
 *  - "ctech-2026" — top 20 of Calcalist/CTech's "50 most promising Israeli
 *                   startups, 2026", with their published rank and sector
 *
 * Sorted so the in-house targets lead, then the CTech list by rank.
 */
export const CLIENTS: ClientCompany[] = (raw as ClientCompany[])
  .slice()
  .sort((a, b) => {
    if (a.source !== b.source) return a.source === "provided" ? -1 : 1;
    if (a.source === "ctech-2026") return (a.rank ?? 99) - (b.rank ?? 99);
    return a.name.localeCompare(b.name);
  });

export function getClient(id: string): ClientCompany | undefined {
  return CLIENTS.find((c) => c.id === id);
}
