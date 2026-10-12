import { pgTable, varchar, uuid, decimal, pgEnum, jsonb } from "drizzle-orm/pg-core";
import { commonFields } from "./common";
import { allergen } from "./allergens";

export const ingredientCategoryEnum = pgEnum("ingredient_category", [
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

export const ingredient = pgTable("ingredient", {
  ...commonFields,
  name: varchar("name", { length: 255 }).notNull(),
  aliases: jsonb("aliases").$type<string[]>().default([]),
  category: ingredientCategoryEnum("category"),
  fdcId: varchar("fdc_id", { length: 50 }),
  density: decimal("density", { precision: 10, scale: 4 }),
  defaultStoreUnit: varchar("default_store_unit", { length: 50 }),
});

export const allergenRelationEnum = pgEnum("allergen_relation", [
  "contains",
  "may_contain",
  "derived_from",
  "commonly_cross_contact",
]);

export const ingredientAllergen = pgTable("ingredient_allergen", {
  ...commonFields,
  ingredientId: uuid("ingredient_id")
    .notNull()
    .references(() => ingredient.id),
  allergenId: uuid("allergen_id")
    .notNull()
    .references(() => allergen.id),
  relation: allergenRelationEnum("relation").notNull(),
  source: varchar("source", { length: 255 }),
  reviewedBy: uuid("reviewed_by"),
});

export const unitSystemEnum = pgEnum("unit_system", ["metric", "us", "count"]);

export const unit = pgTable("unit", {
  ...commonFields,
  name: varchar("name", { length: 100 }).notNull(),
  abbreviation: varchar("abbreviation", { length: 20 }),
  system: unitSystemEnum("system").notNull(),
  conversionToBase: decimal("conversion_to_base", { precision: 20, scale: 10 }),
  baseUnit: varchar("base_unit", { length: 100 }),
});
