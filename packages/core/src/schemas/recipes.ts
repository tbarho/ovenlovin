import { z } from "zod";
import { baseEntitySchema, createdBySchema, uuidSchema } from "./common";

export const recipeStatusSchema = z.enum(["draft", "needs_review", "published"]);

export const recipeVisibilitySchema = z.enum(["private", "household", "shared", "public"]);

export const recipeMethodTagSchema = z.enum([
  "crock_pot",
  "instant_pot",
  "sheet_pan",
  "grill",
  "no_cook",
  "freezer_friendly",
  "make_ahead",
]);

export const recipeSchema = baseEntitySchema.merge(createdBySchema).extend({
  householdId: uuidSchema,
  title: z.string().min(1).max(500),
  slug: z.string().min(1).max(500),
  description: z.string().nullable().optional(),
  yieldQuantity: z.number().positive().nullable().optional(),
  yieldUnit: z.string().max(50).nullable().optional(),
  servings: z.number().int().positive().nullable().optional(),
  prepTimeMinutes: z.number().int().nonnegative().nullable().optional(),
  cookTimeMinutes: z.number().int().nonnegative().nullable().optional(),
  totalTimeMinutes: z.number().int().nonnegative().nullable().optional(),
  activeTimeMinutes: z.number().int().nonnegative().nullable().optional(),
  methodTags: z.array(recipeMethodTagSchema).default([]),
  cuisine: z.string().max(100).nullable().optional(),
  course: z.string().max(100).nullable().optional(),
  difficulty: z.string().max(50).nullable().optional(),
  equipment: z.array(z.string()).default([]),
  images: z.array(z.string()).default([]),
  status: recipeStatusSchema.default("draft"),
  visibility: recipeVisibilitySchema.default("private"),
  version: z.number().int().positive().default(1),
  parentRecipeId: uuidSchema.nullable().optional(),
  isFamilyRecipe: z.boolean().default(false),
  familyStory: z.string().nullable().optional(),
});

export const recipeIngredientGroupSchema = baseEntitySchema.extend({
  recipeId: uuidSchema,
  name: z.string().max(255).nullable().optional(),
  order: z.number().int().nonnegative(),
});

export const recipeIngredientSchema = baseEntitySchema.extend({
  recipeId: uuidSchema,
  groupId: uuidSchema.nullable().optional(),
  order: z.number().int().nonnegative(),
  rawText: z.string().min(1),
  quantityMin: z.number().nonnegative().nullable().optional(),
  quantityMax: z.number().positive().nullable().optional(),
  unit: z.string().max(100).nullable().optional(),
  originalUnit: z.string().max(100).nullable().optional(),
  ingredientId: uuidSchema.nullable().optional(),
  preparation: z.string().max(255).nullable().optional(),
  isOptional: z.boolean().default(false),
  substitutionNotes: z.string().nullable().optional(),
  parseConfidence: z.number().min(0).max(1).nullable().optional(),
});

export const recipeTimerSchema = z.object({
  duration: z.number().int().positive(),
  label: z.string().optional(),
});

export const recipeStepSchema = baseEntitySchema.extend({
  recipeId: uuidSchema,
  order: z.number().int().nonnegative(),
  text: z.string().min(1),
  timers: z.array(recipeTimerSchema).default([]),
  referencedIngredientIds: z.array(uuidSchema).default([]),
  image: z.string().max(500).nullable().optional(),
});

export const recipeNutritionSchema = baseEntitySchema.extend({
  recipeId: uuidSchema,
  perServing: z.boolean().default(true),
  calories: z.number().nonnegative().nullable().optional(),
  protein: z.number().nonnegative().nullable().optional(),
  carbohydrates: z.number().nonnegative().nullable().optional(),
  fat: z.number().nonnegative().nullable().optional(),
  fiber: z.number().nonnegative().nullable().optional(),
  sugar: z.number().nonnegative().nullable().optional(),
  sodium: z.number().nonnegative().nullable().optional(),
  isComputed: z.boolean().default(true),
  computationMethod: z.string().max(100).nullable().optional(),
  confidence: z.number().min(0).max(1).nullable().optional(),
});

export const recipeSourceTypeSchema = z.enum([
  "url",
  "photo",
  "voice",
  "paste",
  "email",
  "pdf",
  "gdoc",
  "app_export",
  "social",
  "manual",
]);

export const recipeSourceSchema = baseEntitySchema.extend({
  recipeId: uuidSchema,
  type: recipeSourceTypeSchema,
  url: z.string().max(2048).nullable().optional(),
  canonicalUrl: z.string().max(2048).nullable().optional(),
  author: z.string().max(255).nullable().optional(),
  attribution: z.string().nullable().optional(),
  blobRefs: z.array(z.string()).default([]),
  importerName: z.string().max(100).nullable().optional(),
  importerVersion: z.string().max(50).nullable().optional(),
  modelUsed: z.string().max(100).nullable().optional(),
  rawExtractionJson: z.record(z.string(), z.unknown()).nullable().optional(),
  licenseNote: z.string().nullable().optional(),
});

export type RecipeStatus = z.infer<typeof recipeStatusSchema>;
export type RecipeVisibility = z.infer<typeof recipeVisibilitySchema>;
export type RecipeMethodTag = z.infer<typeof recipeMethodTagSchema>;
export type Recipe = z.infer<typeof recipeSchema>;
export type RecipeIngredientGroup = z.infer<typeof recipeIngredientGroupSchema>;
export type RecipeIngredient = z.infer<typeof recipeIngredientSchema>;
export type RecipeTimer = z.infer<typeof recipeTimerSchema>;
export type RecipeStep = z.infer<typeof recipeStepSchema>;
export type RecipeNutrition = z.infer<typeof recipeNutritionSchema>;
export type RecipeSourceType = z.infer<typeof recipeSourceTypeSchema>;
export type RecipeSource = z.infer<typeof recipeSourceSchema>;
