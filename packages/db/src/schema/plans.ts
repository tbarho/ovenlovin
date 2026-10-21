import {
  pgTable,
  varchar,
  uuid,
  text,
  integer,
  jsonb,
  pgEnum,
  date,
  timestamp,
  boolean,
  decimal,
} from "drizzle-orm/pg-core";
import { commonFields, createdByField } from "./common";
import { apiKey, household } from "./households";
import { recipe } from "./recipes";
import { person, personRule } from "./people";

export const busyLevelEnum = pgEnum("busy_level", ["low", "medium", "high"]);

export const scheduleTemplate = pgTable("schedule_template", {
  ...commonFields,
  ...createdByField,
  householdId: uuid("household_id")
    .notNull()
    .references(() => household.id),
  name: varchar("name", { length: 255 }).notNull(),
  dayOfWeek: integer("day_of_week").notNull(),
  mealSlot: varchar("meal_slot", { length: 50 }).notNull(),
  busyLevel: busyLevelEnum("busy_level"),
  timeBudgetMinutes: integer("time_budget_minutes"),
  attendees: jsonb("attendees").$type<string[]>().default([]),
  constraints: jsonb("constraints")
    .$type<
      Array<{
        type: string;
        value?: string | number | boolean;
      }>
    >()
    .default([]),
});

export const scheduleOverride = pgTable("schedule_override", {
  ...commonFields,
  ...createdByField,
  householdId: uuid("household_id")
    .notNull()
    .references(() => household.id),
  date: date("date").notNull(),
  mealSlot: varchar("meal_slot", { length: 50 }).notNull(),
  busyLevel: busyLevelEnum("busy_level"),
  timeBudgetMinutes: integer("time_budget_minutes"),
  attendees: jsonb("attendees").$type<string[]>(),
  constraints: jsonb("constraints")
    .$type<
      Array<{
        type: string;
        value?: string | number | boolean;
      }>
    >()
    .default([]),
  reason: varchar("reason", { length: 255 }),
});

export const mealPlanStatusEnum = pgEnum("meal_plan_status", ["draft", "approved", "archived"]);

export const mealPlan = pgTable("meal_plan", {
  ...commonFields,
  ...createdByField,
  householdId: uuid("household_id")
    .notNull()
    .references(() => household.id),
  weekStart: date("week_start").notNull(),
  /** Chosen cook-for for the week. Night labels and the shopping list read this. */
  cookFor: integer("cook_for"),
  status: mealPlanStatusEnum("status").notNull().default("draft"),
  generator: varchar("generator", { length: 255 }),
  generatorModel: varchar("generator_model", { length: 100 }),
  latestCheckReport: jsonb("latest_check_report"),
  checkedAt: timestamp("checked_at", { withTimezone: true }),
  contentHash: varchar("content_hash", { length: 64 }),
  acknowledgedWarnings: jsonb("acknowledged_warnings").$type<string[]>().default([]),
  editHistory: jsonb("edit_history")
    .$type<
      Array<{
        id: string;
        createdAt: string;
        action: string;
        entries: Array<{
          date: string;
          meal: string;
          recipeId?: string;
          freeformMeal?: string;
          servings?: number;
          attendees?: string[];
          prepAheadNotes?: string;
        }>;
      }>
    >()
    .default([]),
  needsRecheck: boolean("needs_recheck").default(false),
  shoppingState: jsonb("shopping_state").$type<{
    checkedKeys: string[];
    extras: Array<{ key: string; name: string }>;
  }>(),
  createdByApiKeyId: uuid("created_by_api_key_id").references(() => apiKey.id),
});

export const mealPlanEntry = pgTable("meal_plan_entry", {
  ...commonFields,
  mealPlanId: uuid("meal_plan_id")
    .notNull()
    .references(() => mealPlan.id),
  date: date("date").notNull(),
  mealSlot: varchar("meal_slot", { length: 50 }).notNull(),
  recipeId: uuid("recipe_id").references(() => recipe.id),
  freeformMeal: varchar("freeform_meal", { length: 255 }),
  servings: integer("servings"),
  attendees: jsonb("attendees").$type<string[]>().default([]),
  scaleFactor: decimal("scale_factor", { precision: 10, scale: 4 }).default("1"),
  prepAheadNotes: text("prep_ahead_notes"),
  leftoverSourceId: uuid("leftover_source_id"),
});

export const checkResult = pgTable("check_result", {
  ...commonFields,
  mealPlanId: uuid("meal_plan_id")
    .notNull()
    .references(() => mealPlan.id),
  entryId: uuid("entry_id").references(() => mealPlanEntry.id),
  personId: uuid("person_id")
    .notNull()
    .references(() => person.id),
  personRuleId: uuid("person_rule_id").references(() => personRule.id),
  severity: varchar("severity", { length: 50 }).notNull(),
  message: text("message").notNull(),
  evidence: jsonb("evidence"),
});
