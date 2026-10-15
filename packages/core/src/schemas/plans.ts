import { z } from "zod";
import { baseEntitySchema, createdBySchema, uuidSchema } from "./common";
import { shoppingTripStateSchema } from "./shopping-trip";

export const busyLevelSchema = z.enum(["low", "medium", "high"]);

export const scheduleConstraintSchema = z.object({
  type: z.string(),
  value: z.union([z.string(), z.number(), z.boolean()]).optional(),
});

export const scheduleTemplateSchema = baseEntitySchema.merge(createdBySchema).extend({
  householdId: uuidSchema,
  name: z.string().min(1).max(255),
  dayOfWeek: z.number().int().min(0).max(6),
  mealSlot: z.string().max(50),
  busyLevel: busyLevelSchema.nullable().optional(),
  timeBudgetMinutes: z.number().int().positive().nullable().optional(),
  attendees: z.array(uuidSchema).default([]),
  constraints: z.array(scheduleConstraintSchema).default([]),
});

export const scheduleOverrideSchema = baseEntitySchema.merge(createdBySchema).extend({
  householdId: uuidSchema,
  date: z.string().date(),
  mealSlot: z.string().max(50),
  busyLevel: busyLevelSchema.nullable().optional(),
  timeBudgetMinutes: z.number().int().positive().nullable().optional(),
  attendees: z.array(uuidSchema).nullable().optional(),
  constraints: z.array(scheduleConstraintSchema).default([]),
  reason: z.string().max(255).nullable().optional(),
});

export const mealPlanStatusSchema = z.enum(["draft", "approved", "archived"]);

export const mealPlanSchema = baseEntitySchema.merge(createdBySchema).extend({
  householdId: uuidSchema,
  weekStart: z.string().date(),
  status: mealPlanStatusSchema.default("draft"),
  generator: z.string().max(255).nullable().optional(),
  generatorModel: z.string().max(100).nullable().optional(),
  latestCheckReport: z.record(z.string(), z.unknown()).nullable().optional(),
  checkedAt: z.string().datetime().nullable().optional(),
  contentHash: z.string().max(64).nullable().optional(),
  acknowledgedWarnings: z.array(z.string()).default([]),
  needsRecheck: z.boolean().default(false),
  shoppingState: shoppingTripStateSchema.optional(),
  createdByApiKeyId: uuidSchema.nullable().optional(),
});

export const mealPlanEntrySchema = baseEntitySchema.extend({
  mealPlanId: uuidSchema,
  date: z.string().date(),
  mealSlot: z.string().max(50),
  recipeId: uuidSchema.nullable().optional(),
  freeformMeal: z.string().max(255).nullable().optional(),
  servings: z.number().int().positive().nullable().optional(),
  attendees: z.array(uuidSchema).default([]),
  scaleFactor: z.number().positive().default(1),
  prepAheadNotes: z.string().nullable().optional(),
  leftoverSourceId: uuidSchema.nullable().optional(),
});

/** REST / MCP write shape for a plan entry. `meal` is the slot name. */
export const mealPlanEntryWriteSchema = z
  .object({
    date: z.string().date(),
    meal: z.string().min(1).max(50),
    recipeId: uuidSchema.optional(),
    freeformMeal: z.string().min(1).max(255).optional(),
    servings: z.number().int().positive().optional(),
    attendees: z.array(uuidSchema).default([]),
    prepAheadNotes: z.string().optional(),
  })
  .strict();

/**
 * PATCH upsert for one night. Omitted fields keep the current value.
 * `clear: true` removes that date+meal. `attendees` is not defaulted so a
 * single-night edit cannot wipe the rest of the week's guest list.
 */
export const mealPlanEntryPatchSchema = z
  .object({
    date: z.string().date(),
    meal: z.string().min(1).max(50),
    clear: z.boolean().optional(),
    recipeId: uuidSchema.optional(),
    freeformMeal: z.string().min(1).max(255).optional(),
    servings: z.number().int().positive().optional(),
    attendees: z.array(uuidSchema).optional(),
    prepAheadNotes: z.string().optional(),
  })
  .strict();

export const createMealPlanBodySchema = z
  .object({
    weekStart: z.string().date(),
    status: z.enum(["draft", "approved"]).optional(),
    entries: z.array(mealPlanEntryWriteSchema).optional(),
  })
  .strict();

export const updateMealPlanBodySchema = z
  .object({
    status: mealPlanStatusSchema.optional(),
    acknowledgedWarnings: z.array(z.string()).optional(),
    entries: z.array(mealPlanEntryPatchSchema).optional(),
    entriesMode: z
      .enum(["merge", "replace"])
      .optional()
      .describe(
        "How `entries` are applied. Default `merge` upserts by date+meal (use clear:true to remove a night). `replace` rewrites the whole week."
      ),
    shoppingState: shoppingTripStateSchema.optional(),
  })
  .strict();

export const checkFindingSeveritySchema = z.enum(["block", "warn", "prefer_avoid"]);

export const checkFindingSchema = z.object({
  entryId: uuidSchema,
  personId: uuidSchema,
  personName: z.string(),
  ruleId: uuidSchema.nullable().optional(),
  severity: checkFindingSeveritySchema,
  message: z.string(),
  evidence: z.record(z.string(), z.unknown()).optional(),
});

export const checkResultSchema = baseEntitySchema.extend({
  mealPlanId: uuidSchema,
  entryId: uuidSchema.nullable().optional(),
  personId: uuidSchema,
  personRuleId: uuidSchema.nullable().optional(),
  severity: z.string().max(50),
  message: z.string(),
  evidence: z.record(z.string(), z.unknown()).nullable().optional(),
});

export const checkReportSchema = z.object({
  status: z.enum(["complete", "incomplete"]),
  planId: uuidSchema,
  checkedAt: z.string().datetime(),
  findings: z.array(checkFindingSchema),
  incompleteReasons: z.array(z.string()).default([]),
  summary: z.object({
    totalEntries: z.number().int().nonnegative(),
    entriesWithBlocks: z.number().int().nonnegative(),
    entriesWithWarnings: z.number().int().nonnegative(),
    affectedPeople: z.array(z.string()),
  }),
});

export type BusyLevel = z.infer<typeof busyLevelSchema>;
export type ScheduleConstraint = z.infer<typeof scheduleConstraintSchema>;
export type ScheduleTemplate = z.infer<typeof scheduleTemplateSchema>;
export type ScheduleOverride = z.infer<typeof scheduleOverrideSchema>;
export type MealPlanStatus = z.infer<typeof mealPlanStatusSchema>;
export type MealPlan = z.infer<typeof mealPlanSchema>;
export type MealPlanEntry = z.infer<typeof mealPlanEntrySchema>;
export type MealPlanEntryWrite = z.infer<typeof mealPlanEntryWriteSchema>;
export type MealPlanEntryPatch = z.infer<typeof mealPlanEntryPatchSchema>;
export type CreateMealPlanBody = z.infer<typeof createMealPlanBodySchema>;
export type UpdateMealPlanBody = z.infer<typeof updateMealPlanBodySchema>;
export type CheckFindingSeverity = z.infer<typeof checkFindingSeveritySchema>;
export type CheckFinding = z.infer<typeof checkFindingSchema>;
export type CheckResult = z.infer<typeof checkResultSchema>;
export type CheckReport = z.infer<typeof checkReportSchema>;
