import { z } from "zod";

/** Shape of `collection.book_settings`. Null or missing fields mean the house default. */
export const bookSettingsSchema = z.object({
  cover: z
    .union([
      z.object({ kind: z.literal("type") }),
      z.object({ kind: z.literal("recipe"), recipeId: z.string() }),
      z.object({ kind: z.literal("photo"), image: z.string() }),
    ])
    .optional(),
  title: z.string().max(255).optional(),
  subtitle: z.string().max(255).optional(),
  dedication: z.string().max(500).optional(),
  includeCards: z.boolean().optional(),
});

export type BookSettings = z.infer<typeof bookSettingsSchema>;

export function readBookSettings(raw: unknown): BookSettings {
  const parsed = bookSettingsSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : {};
}
