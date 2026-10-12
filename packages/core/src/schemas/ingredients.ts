import { z } from "zod";
import { baseEntitySchema, uuidSchema } from "./common";

export const ingredientCategorySchema = z.enum([
  "produce",
  "dairy",
  "meat",
  "seafood",
  "grains",
  "pantry",
  "spices",
  "baking",
  "frozen",
  "canned",
  "condiments",
  "beverages",
  "other",
]);

export const ingredientSchema = baseEntitySchema.extend({
  name: z.string().min(1).max(255),
  aliases: z.array(z.string()).default([]),
  category: ingredientCategorySchema.nullable().optional(),
  fdcId: z.string().max(50).nullable().optional(),
  density: z.number().positive().nullable().optional(),
  defaultStoreUnit: z.string().max(50).nullable().optional(),
});

export const allergenRelationSchema = z.enum([
  "contains",
  "may_contain",
  "derived_from",
  "commonly_cross_contact",
]);

export const ingredientAllergenSchema = baseEntitySchema.extend({
  ingredientId: uuidSchema,
  allergenId: uuidSchema,
  relation: allergenRelationSchema,
  source: z.string().max(255).nullable().optional(),
  reviewedBy: uuidSchema.nullable().optional(),
});

export const unitSystemSchema = z.enum(["metric", "us", "count"]);

export const unitSchema = baseEntitySchema.extend({
  name: z.string().max(100),
  abbreviation: z.string().max(20).nullable().optional(),
  system: unitSystemSchema,
  conversionToBase: z.number().positive().nullable().optional(),
  baseUnit: z.string().max(100).nullable().optional(),
});

export type IngredientCategory = z.infer<typeof ingredientCategorySchema>;
export type Ingredient = z.infer<typeof ingredientSchema>;
export type AllergenRelation = z.infer<typeof allergenRelationSchema>;
export type IngredientAllergen = z.infer<typeof ingredientAllergenSchema>;
export type UnitSystem = z.infer<typeof unitSystemSchema>;
export type Unit = z.infer<typeof unitSchema>;
