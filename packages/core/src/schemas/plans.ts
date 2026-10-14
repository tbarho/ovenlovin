import { z } from "zod";
import { baseEntitySchema, createdBySchema, uuidSchema } from "./common";

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
export type CheckFindingSeverity = z.infer<typeof checkFindingSeveritySchema>;
export type CheckFinding = z.infer<typeof checkFindingSchema>;
export type CheckResult = z.infer<typeof checkResultSchema>;
export type CheckReport = z.infer<typeof checkReportSchema>;
