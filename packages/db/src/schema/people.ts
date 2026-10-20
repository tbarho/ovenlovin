import {
  pgTable,
  varchar,
  uuid,
  text,
  integer,
  pgEnum,
  date,
  boolean,
  decimal,
} from "drizzle-orm/pg-core";
import { commonFields, createdByField } from "./common";
import { apiKey, household, user } from "./households";

export const sexEnum = pgEnum("sex", ["male", "female", "other"]);

export const person = pgTable("person", {
  ...commonFields,
  ...createdByField,
  householdId: uuid("household_id")
    .notNull()
    .references(() => household.id),
  userId: uuid("user_id").references(() => user.id),
  displayName: varchar("display_name", { length: 255 }).notNull(),
  birthYear: integer("birth_year"),
  birthMonth: integer("birth_month"),
  sex: sexEnum("sex"),
  activityProfile: text("activity_profile"),
  notes: text("notes"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const ruleKindEnum = pgEnum("rule_kind", [
  "allergen",
  "ingredient",
  "ingredient_category",
  "diet",
  "tag",
  "custom",
]);

export const severityEnum = pgEnum("severity", ["block", "warn", "prefer_avoid"]);

export const sharedFacilityEnum = pgEnum("shared_facility", ["block", "warn", "ignore"]);

export const personRule = pgTable("person_rule", {
  ...commonFields,
  ...createdByField,
  personId: uuid("person_id")
    .notNull()
    .references(() => person.id),
  kind: ruleKindEnum("kind").notNull(),
  target: varchar("target", { length: 255 }).notNull(),
  severity: severityEnum("severity").notNull(),
  includeMayContain: boolean("include_may_contain").default(true),
  includeCrossContact: boolean("include_cross_contact").default(true),
  sharedFacility: sharedFacilityEnum("shared_facility").default("block"),
  includeUnmappedIngredients: boolean("include_unmapped_ingredients").default(false),
  includeDescendants: boolean("include_descendants").default(true),
  treatCoconutAsTreeNut: boolean("treat_coconut_as_tree_nut").default(false),
  label: varchar("label", { length: 255 }),
  note: text("note"),
  activeFrom: date("active_from"),
  activeUntil: date("active_until"),
  setBy: uuid("set_by")
    .notNull()
    .references(() => user.id),
  createdByApiKeyId: uuid("created_by_api_key_id").references(() => apiKey.id),
});

export const personLabelNote = pgTable("person_label_note", {
  ...commonFields,
  ...createdByField,
  personId: uuid("person_id")
    .notNull()
    .references(() => person.id),
  note: text("note").notNull(),
  ingredientId: uuid("ingredient_id"),
  category: varchar("category", { length: 100 }),
});

export const preference = pgTable("preference", {
  ...commonFields,
  ...createdByField,
  personId: uuid("person_id")
    .notNull()
    .references(() => person.id),
  type: varchar("type", { length: 50 }).notNull(),
  value: varchar("value", { length: 255 }).notNull(),
  weight: integer("weight").default(1),
});

export const nutritionGoal = pgTable("nutrition_goal", {
  ...commonFields,
  ...createdByField,
  personId: uuid("person_id")
    .notNull()
    .references(() => person.id),
  metric: varchar("metric", { length: 100 }).notNull(),
  targetMin: decimal("target_min", { precision: 10, scale: 2 }),
  targetMax: decimal("target_max", { precision: 10, scale: 2 }),
  period: varchar("period", { length: 50 }).notNull().default("day"),
  rationale: varchar("rationale", { length: 100 }),
  activeFrom: date("active_from"),
  activeUntil: date("active_until"),
});
