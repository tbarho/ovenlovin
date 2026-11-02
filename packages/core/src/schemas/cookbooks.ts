import { z } from "zod";
import { baseEntitySchema, createdBySchema, uuidSchema } from "./common";
import { recipeVisibilitySchema } from "./recipes";
import { bookSettingsInputSchema } from "../book/settings";

export const cookbookSchema = baseEntitySchema.merge(createdBySchema).extend({
  householdId: uuidSchema,
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(255),
  description: z.string().nullable().optional(),
  visibility: recipeVisibilitySchema.default("private"),
  sortOrder: z.number().int().nonnegative().default(0),
  bookSettings: z.record(z.string(), z.unknown()).nullable().optional(),
});

export const cookbookSummarySchema = z.object({
  id: uuidSchema,
  name: z.string(),
  slug: z.string(),
});

export const cookbookCardSchema = cookbookSchema.extend({
  recipeCount: z.number().int().nonnegative(),
  previewImages: z.array(z.string()).default([]),
});

export const cookbookRecipeSchema = baseEntitySchema.extend({
  cookbookId: uuidSchema,
  recipeId: uuidSchema,
  order: z.number().int().nonnegative().nullable().optional(),
});

export const createCookbookBodySchema = z.object({
  name: z.string().trim().min(1).max(255),
  description: z.string().max(10_000).nullable().optional(),
});

export const updateCookbookBodySchema = z
  .object({
    name: z.string().trim().min(1).max(255).optional(),
    description: z.string().max(10_000).nullable().optional(),
    sortOrder: z.number().int().nonnegative().optional(),
    /** "Make it yours": replaces the whole book settings object; null resets to the default. */
    bookSettings: bookSettingsInputSchema.nullable().optional(),
    /** Every recipe id in the cookbook, once each, in the new book order. */
    recipeOrder: z.array(uuidSchema).max(5000).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Request body cannot be empty" });

export const addCookbookRecipeBodySchema = z.object({
  recipeId: uuidSchema,
});

export type Cookbook = z.infer<typeof cookbookSchema>;
export type CookbookSummary = z.infer<typeof cookbookSummarySchema>;
export type CookbookCard = z.infer<typeof cookbookCardSchema>;
export type CookbookRecipe = z.infer<typeof cookbookRecipeSchema>;

export function slugifyCookbookName(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug || "cookbook";
}
