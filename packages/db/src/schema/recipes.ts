import {
  pgTable,
  varchar,
  uuid,
  text,
  integer,
  jsonb,
  pgEnum,
  decimal,
  boolean,
} from "drizzle-orm/pg-core";
import { commonFields, createdByField } from "./common";
import { household } from "./households";
import { ingredient } from "./ingredients";

export const recipeStatusEnum = pgEnum("recipe_status", ["draft", "needs_review", "published"]);

export const recipeVisibilityEnum = pgEnum("recipe_visibility", [
  "private",
  "household",
  "shared",
  "public",
]);

export const recipe = pgTable("recipe", {
  ...commonFields,
  ...createdByField,
  householdId: uuid("household_id")
    .notNull()
    .references(() => household.id),
  title: varchar("title", { length: 500 }).notNull(),
  slug: varchar("slug", { length: 500 }).notNull(),
  description: text("description"),
  yieldQuantity: decimal("yield_quantity", { precision: 10, scale: 2 }),
  yieldUnit: varchar("yield_unit", { length: 50 }),
  servings: integer("servings"),
  prepTimeMinutes: integer("prep_time_minutes"),
  cookTimeMinutes: integer("cook_time_minutes"),
  totalTimeMinutes: integer("total_time_minutes"),
  activeTimeMinutes: integer("active_time_minutes"),
  methodTags: jsonb("method_tags").$type<string[]>().default([]),
  cuisine: varchar("cuisine", { length: 100 }),
  course: varchar("course", { length: 100 }),
  difficulty: varchar("difficulty", { length: 50 }),
  equipment: jsonb("equipment").$type<string[]>().default([]),
  images: jsonb("images").$type<string[]>().default([]),
  status: recipeStatusEnum("status").notNull().default("draft"),
  visibility: recipeVisibilityEnum("visibility").notNull().default("private"),
  version: integer("version").notNull().default(1),
  parentRecipeId: uuid("parent_recipe_id"),
  isFamilyRecipe: boolean("is_family_recipe").default(false),
  familyStory: text("family_story"),
});

export const recipeIngredientGroup = pgTable("recipe_ingredient_group", {
  ...commonFields,
  recipeId: uuid("recipe_id")
    .notNull()
    .references(() => recipe.id),
  name: varchar("name", { length: 255 }),
  order: integer("order").notNull(),
});

export const recipeIngredient = pgTable("recipe_ingredient", {
  ...commonFields,
  recipeId: uuid("recipe_id")
    .notNull()
    .references(() => recipe.id),
  groupId: uuid("group_id").references(() => recipeIngredientGroup.id),
  order: integer("order").notNull(),
  rawText: text("raw_text").notNull(),
  quantityMin: decimal("quantity_min", { precision: 10, scale: 4 }),
  quantityMax: decimal("quantity_max", { precision: 10, scale: 4 }),
  unit: varchar("unit", { length: 100 }),
  originalUnit: varchar("original_unit", { length: 100 }),
  ingredientId: uuid("ingredient_id").references(() => ingredient.id),
  preparation: varchar("preparation", { length: 255 }),
  isOptional: boolean("is_optional").default(false),
  substitutionNotes: text("substitution_notes"),
  parseConfidence: decimal("parse_confidence", { precision: 3, scale: 2 }),
});

export const recipeStep = pgTable("recipe_step", {
  ...commonFields,
  recipeId: uuid("recipe_id")
    .notNull()
    .references(() => recipe.id),
  order: integer("order").notNull(),
  text: text("text").notNull(),
  timers: jsonb("timers").$type<Array<{ duration: number; label?: string }>>().default([]),
  referencedIngredientIds: jsonb("referenced_ingredient_ids").$type<string[]>().default([]),
  image: varchar("image", { length: 500 }),
});

export const recipeNutrition = pgTable("recipe_nutrition", {
  ...commonFields,
  recipeId: uuid("recipe_id")
    .notNull()
    .references(() => recipe.id),
  perServing: boolean("per_serving").notNull().default(true),
  calories: decimal("calories", { precision: 10, scale: 2 }),
  protein: decimal("protein", { precision: 10, scale: 2 }),
  carbohydrates: decimal("carbohydrates", { precision: 10, scale: 2 }),
  fat: decimal("fat", { precision: 10, scale: 2 }),
  fiber: decimal("fiber", { precision: 10, scale: 2 }),
  sugar: decimal("sugar", { precision: 10, scale: 2 }),
  sodium: decimal("sodium", { precision: 10, scale: 2 }),
  isComputed: boolean("is_computed").default(true),
  computationMethod: varchar("computation_method", { length: 100 }),
  confidence: decimal("confidence", { precision: 3, scale: 2 }),
});

export const recipeSourceTypeEnum = pgEnum("recipe_source_type", [
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

export const recipeSource = pgTable("recipe_source", {
  ...commonFields,
  recipeId: uuid("recipe_id")
    .notNull()
    .references(() => recipe.id),
  type: recipeSourceTypeEnum("type").notNull(),
  url: varchar("url", { length: 2048 }),
  canonicalUrl: varchar("canonical_url", { length: 2048 }),
  author: varchar("author", { length: 255 }),
  attribution: text("attribution"),
  blobRefs: jsonb("blob_refs").$type<string[]>().default([]),
  importerName: varchar("importer_name", { length: 100 }),
  importerVersion: varchar("importer_version", { length: 50 }),
  modelUsed: varchar("model_used", { length: 100 }),
  rawExtractionJson: jsonb("raw_extraction_json"),
  licenseNote: text("license_note"),
});

export const tag = pgTable("tag", {
  ...commonFields,
  householdId: uuid("household_id")
    .notNull()
    .references(() => household.id),
  name: varchar("name", { length: 100 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull(),
  color: varchar("color", { length: 7 }),
});

export const recipeTag = pgTable("recipe_tag", {
  ...commonFields,
  recipeId: uuid("recipe_id")
    .notNull()
    .references(() => recipe.id),
  tagId: uuid("tag_id")
    .notNull()
    .references(() => tag.id),
});

export const collection = pgTable("collection", {
  ...commonFields,
  ...createdByField,
  householdId: uuid("household_id")
    .notNull()
    .references(() => household.id),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull(),
  description: text("description"),
  visibility: recipeVisibilityEnum("visibility").notNull().default("private"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const collectionRecipe = pgTable("collection_recipe", {
  ...commonFields,
  collectionId: uuid("collection_id")
    .notNull()
    .references(() => collection.id),
  recipeId: uuid("recipe_id")
    .notNull()
    .references(() => recipe.id),
  order: integer("order"),
});

export const recipeRating = pgTable("recipe_rating", {
  ...commonFields,
  recipeId: uuid("recipe_id")
    .notNull()
    .references(() => recipe.id),
  personId: uuid("person_id").notNull(),
  rating: integer("rating").notNull(),
  notes: text("notes"),
});

export const cookLog = pgTable("cook_log", {
  ...commonFields,
  ...createdByField,
  recipeId: uuid("recipe_id")
    .notNull()
    .references(() => recipe.id),
  cookedAt: varchar("cooked_at", { length: 50 }).notNull(),
  notes: text("notes"),
  servingsMade: integer("servings_made"),
});
