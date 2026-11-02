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

/**
 * What a person or bot may set through "Make it yours" (REST PATCH, MCP).
 * The cover is type only or one of the book's own recipe photos: no
 * arbitrary image URLs, so the PDF renderer never fetches a stranger's link.
 */
export const bookSettingsInputSchema = z
  .object({
    cover: z
      .discriminatedUnion("kind", [
        z.object({ kind: z.literal("type") }),
        z.object({ kind: z.literal("recipe"), recipeId: z.string().uuid() }),
      ])
      .optional(),
    title: z.string().trim().max(255).optional(),
    subtitle: z.string().trim().max(255).optional(),
    dedication: z.string().trim().max(500).optional(),
    includeCards: z.boolean().optional(),
  })
  .strict();

export type BookSettingsInput = z.infer<typeof bookSettingsInputSchema>;

export class BookSettingsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BookSettingsError";
  }
}

/**
 * Settings ready to store: blank text dropped (blank means the house
 * default), and a recipe cover must be a recipe in this book.
 */
export function normalizeBookSettings(input: BookSettingsInput, recipeIds: string[]): BookSettings {
  if (input.cover?.kind === "recipe" && !recipeIds.includes(input.cover.recipeId)) {
    throw new BookSettingsError(
      `Cover recipe ${input.cover.recipeId} is not in this cookbook. Add it first, or pick a recipe from GET /api/v1/cookbooks/{id}.`
    );
  }
  const text = (value: string | undefined) => (value?.trim() ? value.trim() : undefined);
  const settings: BookSettings = {
    cover: input.cover,
    title: text(input.title),
    subtitle: text(input.subtitle),
    dedication: text(input.dedication),
    includeCards: input.includeCards,
  };
  return Object.fromEntries(
    Object.entries(settings).filter(([, value]) => value !== undefined)
  ) as BookSettings;
}

/** The requested recipe order, checked to be the book's recipes exactly once each. */
export function orderedRecipeIds(currentIds: string[], requestedIds: string[]): string[] {
  if (new Set(requestedIds).size !== requestedIds.length) {
    throw new BookSettingsError("recipeOrder must not contain duplicates.");
  }
  const current = new Set(currentIds);
  const unknown = requestedIds.find((id) => !current.has(id));
  if (unknown) {
    throw new BookSettingsError(
      `Recipe ${unknown} is not in this cookbook. Use GET /api/v1/cookbooks/{id} for its recipes.`
    );
  }
  if (requestedIds.length !== currentIds.length) {
    throw new BookSettingsError(
      "recipeOrder must list every recipe in the cookbook exactly once. Fetch GET /api/v1/cookbooks/{id}, then send the new order."
    );
  }
  return requestedIds;
}
