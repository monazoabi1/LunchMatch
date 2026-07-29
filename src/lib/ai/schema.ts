import { z } from "zod";

// No numeric fields anywhere — the AI cannot invent or restate a score.
export const AiEnrichmentSchema = z.object({
  restaurants: z
    .array(
      z.object({
        restaurant_id: z.string(),
        why_it_fits: z.string().max(220),
        slogan: z.string().max(60),
      })
    )
    .length(3),
  group_observation: z.string().max(180),
});

export type AiEnrichment = z.infer<typeof AiEnrichmentSchema>;
