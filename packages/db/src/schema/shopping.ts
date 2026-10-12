import {
  pgTable,
  varchar,
  uuid,
  text,
  integer,
  jsonb,
  decimal,
  boolean,
} from "drizzle-orm/pg-core";
import { commonFields, createdByField } from "./common";
import { household } from "./households";
import { ingredient } from "./ingredients";
import { mealPlan } from "./plans";

export const pantryItem = pgTable("pantry_item", {
  ...commonFields,
  ...createdByField,
  householdId: uuid("household_id")
    .notNull()
    .references(() => household.id),
  ingredientId: uuid("ingredient_id")
    .notNull()
    .references(() => ingredient.id),
  quantity: decimal("quantity", { precision: 10, scale: 2 }),
  unit: varchar("unit", { length: 50 }),
  location: varchar("location", { length: 100 }),
});

export const shoppingList = pgTable("shopping_list", {
  ...commonFields,
  ...createdByField,
  householdId: uuid("household_id")
    .notNull()
    .references(() => household.id),
  mealPlanId: uuid("meal_plan_id").references(() => mealPlan.id),
  name: varchar("name", { length: 255 }).notNull(),
});

export const shoppingListItem = pgTable("shopping_list_item", {
  ...commonFields,
  listId: uuid("list_id")
    .notNull()
    .references(() => shoppingList.id),
  ingredientId: uuid("ingredient_id").references(() => ingredient.id),
  name: varchar("name", { length: 255 }).notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 2 }),
  unit: varchar("unit", { length: 50 }),
  storeUnit: varchar("store_unit", { length: 50 }),
  aisleCategory: varchar("aisle_category", { length: 100 }),
  sourceEntries: jsonb("source_entries")
    .$type<
      Array<{
        recipeId: string;
        recipeName: string;
        quantity: number;
        unit: string;
      }>
    >()
    .default([]),
  isChecked: boolean("is_checked").default(false),
  notes: text("notes"),
  ruleWarnings: jsonb("rule_warnings")
    .$type<
      Array<{
        personId: string;
        personName: string;
        severity: string;
        message: string;
      }>
    >()
    .default([]),
  order: integer("order"),
});
