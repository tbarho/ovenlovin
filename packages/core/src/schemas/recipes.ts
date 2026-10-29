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

export const recipeImagesSchema = z.array(z.string());

export function parseRecipeImages(value: unknown): string[] {
  return recipeImagesSchema.parse(value ?? []);
}

export const recipeSchema = baseEntitySchema.merge(createdBySchema).extend({
  householdId: uuidSchema,
  title: z.string().min(1).max(500),
  slug: z.string().min(1).max(500),
  description: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
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
  images: recipeImagesSchema.default([]),
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
  /** Cooking-fraction line for UI / REST / MCP. Stored `rawText` stays as imported. */
  displayText: z.string().optional(),
  name: z.string().min(1).optional(),
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
  bookTitle: z.string().max(500).nullable().optional(),
  pageStart: z.number().int().nullable().optional(),
  pageEnd: z.number().int().nullable().optional(),
  blobRefs: z.array(z.string()).default([]),
  importerName: z.string().max(100).nullable().optional(),
  importerVersion: z.string().max(50).nullable().optional(),
  modelUsed: z.string().max(100).nullable().optional(),
  rawExtractionJson: z.record(z.string(), z.unknown()).nullable().optional(),
  licenseNote: z.string().nullable().optional(),
});

export const createRecipeBodySchema = z.object({
  title: z.string().trim().min(1).max(500),
  description: z.string().max(20_000).optional(),
  notes: z.string().max(20_000).optional(),
  servings: z.number().int().positive().optional(),
  prepTimeMinutes: z.number().int().nonnegative().optional(),
  cookTimeMinutes: z.number().int().nonnegative().optional(),
  totalTimeMinutes: z.number().int().nonnegative().optional(),
  cuisine: z.string().max(100).optional(),
  course: z.string().max(100).optional(),
  images: recipeImagesSchema.max(20).optional(),
  ingredients: z
    .array(z.object({ rawText: z.string().trim().min(1).max(2000) }))
    .max(200)
    .optional(),
  steps: z
    .array(z.object({ text: z.string().trim().min(1).max(10_000) }))
    .max(200)
    .optional(),
  cookbookId: uuidSchema.optional(),
  sourceUrl: z.string().max(2048).optional(),
  status: recipeStatusSchema.optional(),
  source: z
    .object({
      type: recipeSourceTypeSchema.optional(),
      url: z.string().max(2048).optional(),
      canonicalUrl: z.string().max(2048).optional(),
      author: z.string().max(255).optional(),
      importerName: z.string().max(100).optional(),
      importerVersion: z.string().max(50).optional(),
      rawExtractionJson: z.record(z.string(), z.unknown()).optional(),
    })
    .optional(),
  reviewReasons: z.array(z.string().max(500)).max(50).optional(),
  uncertainFields: z.array(z.string().max(200)).max(50).optional(),
});

export const updateRecipeBodySchema = z
  .object({
    title: z.string().trim().min(1).max(500).optional(),
    description: z.string().max(20_000).nullable().optional(),
    notes: z.string().max(20_000).nullable().optional(),
    servings: z.number().int().positive().nullable().optional(),
    cuisine: z.string().max(100).nullable().optional(),
    prepTimeMinutes: z.number().int().nonnegative().nullable().optional(),
    cookTimeMinutes: z.number().int().nonnegative().nullable().optional(),
    totalTimeMinutes: z.number().int().nonnegative().nullable().optional(),
    images: recipeImagesSchema.max(20).optional(),
    cookbookIds: z.array(uuidSchema).max(50).optional(),
    ingredients: z
      .array(
        z.object({
          rawText: z.string().trim().min(1).max(2000),
          quantityMin: z.number().nonnegative().nullable().optional(),
          quantityMax: z.number().positive().nullable().optional(),
          unit: z.string().max(100).nullable().optional(),
          preparation: z.string().max(255).nullable().optional(),
          isOptional: z.boolean().optional(),
        })
      )
      .max(200)
      .optional(),
    steps: z
      .array(
        z.object({
          text: z.string().trim().min(1).max(10_000),
          timers: z
            .array(
              z.object({
                duration: z.number().int().positive(),
                label: z.string().max(255).optional(),
              })
            )
            .max(20)
            .optional(),
        })
      )
      .max(200)
      .optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Request body cannot be empty" });

export const importRecipeBodySchema = z.object({
  source: z.enum(["url", "paste"]),
  content: z.string().max(200_000).optional(),
  save: z.union([z.boolean(), z.string()]).optional(),
  draft: z.unknown().optional(),
  allowDuplicate: z.boolean().optional(),
  cookbookId: uuidSchema.optional(),
  /** Instagram permalink when the content is a pasted caption. */
  sourceUrl: z.string().max(2048).optional(),
  /** @handle to credit on a pasted Instagram caption. */
  creator: z.string().max(255).optional(),
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

export type RecipeNutritionFacts = {
  perServing: boolean;
  calories?: number;
  protein?: number;
  carbohydrates?: number;
  fat?: number;
  fiber?: number;
  sugar?: number;
  sodium?: number;
};

export type RecipeDetails = Recipe & {
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
  source: RecipeSource | null;
  cookbooks: Array<{ id: string; name: string; slug: string }>;
  nutrition: RecipeNutritionFacts | null;
  reviewReasons: string[];
  uncertainFields: string[];
  displayServings?: number;
  scaledNote?: string | null;
};

export type RecipeContentUpdate = {
  title?: string;
  description?: string | null;
  notes?: string | null;
  servings?: number | null;
  cuisine?: string | null;
  prepTimeMinutes?: number | null;
  cookTimeMinutes?: number | null;
  totalTimeMinutes?: number | null;
  images?: string[];
  cookbookIds?: string[];
  ingredients?: Array<{
    rawText: string;
    quantityMin?: number | null;
    quantityMax?: number | null;
    unit?: string | null;
    preparation?: string | null;
    isOptional?: boolean;
  }>;
  steps?: Array<{
    text: string;
    timers?: Array<{ duration: number; label?: string }>;
  }>;
};

export type RecipeImportDraft = {
  title: string;
  description?: string;
  notes?: string;
  yieldQuantity?: number;
  yieldUnit?: string;
  servings?: number;
  prepTimeMinutes?: number;
  cookTimeMinutes?: number;
  totalTimeMinutes?: number;
  activeTimeMinutes?: number;
  methodTags?: string[];
  cuisine?: string;
  course?: string;
  difficulty?: string;
  equipment?: string[];
  images?: string[];
  nutrition?: RecipeNutritionFacts;
  ingredients: Array<{
    rawText: string;
    quantity?: { min: number; max?: number };
    unit?: string;
    originalUnit?: string;
    preparation?: string;
    isOptional?: boolean;
    substitutionNotes?: string;
    confidence?: number;
  }>;
  steps: Array<{
    text: string;
    order?: number;
    timers?: Array<{ duration: number; label?: string }>;
  }>;
  source: {
    type: RecipeSourceType;
    url?: string;
    canonicalUrl?: string;
    author?: string;
    attribution?: string;
    /** PDF book imports: book title and the PDF pages the recipe spans. */
    bookTitle?: string;
    pageStart?: number;
    pageEnd?: number;
    blobRefs?: string[];
    importerName: string;
    importerVersion: string;
    modelUsed?: string;
    rawExtractionJson: Record<string, unknown>;
    licenseNote?: string;
  };
  needsReview?: boolean;
  reviewReasons?: string[];
  uncertainFields?: string[];
};

export function slugifyTitle(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug || "recipe";
}
