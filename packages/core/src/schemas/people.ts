import { z } from "zod";
import { baseEntitySchema, createdBySchema, uuidSchema } from "./common";

export const sexSchema = z.enum(["male", "female", "other"]);

export const personSchema = baseEntitySchema.merge(createdBySchema).extend({
  householdId: uuidSchema,
  userId: uuidSchema.nullable().optional(),
  displayName: z.string().min(1).max(255),
  birthYear: z.number().int().min(1900).max(2100).nullable().optional(),
  birthMonth: z.number().int().min(1).max(12).nullable().optional(),
  sex: sexSchema.nullable().optional(),
  activityProfile: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const ruleKindSchema = z.enum([
  "allergen",
  "ingredient",
  "ingredient_category",
  "diet",
  "tag",
  "custom",
]);

export const severitySchema = z.enum(["block", "warn", "prefer_avoid"]);

export const sharedFacilitySchema = z.enum(["block", "warn", "ignore"]);

export const personRuleSchema = baseEntitySchema.merge(createdBySchema).extend({
  personId: uuidSchema,
  kind: ruleKindSchema,
  target: z.string().min(1).max(255),
  severity: severitySchema,
  includeMayContain: z.boolean().default(false),
  includeCrossContact: z.boolean().default(false),
  sharedFacility: sharedFacilitySchema.default("ignore"),
  includeUnmappedIngredients: z.boolean().default(false),
  includeDescendants: z.boolean().default(true),
  treatCoconutAsTreeNut: z.boolean().default(true),
  label: z.string().max(255).nullable().optional(),
  note: z.string().nullable().optional(),
  activeFrom: z.string().date().nullable().optional(),
  activeUntil: z.string().date().nullable().optional(),
  setBy: uuidSchema,
});

export const personLabelNoteSchema = baseEntitySchema.merge(createdBySchema).extend({
  personId: uuidSchema,
  note: z.string().min(1),
  ingredientId: uuidSchema.nullable().optional(),
  category: z.string().max(100).nullable().optional(),
});

export const preferenceSchema = baseEntitySchema.merge(createdBySchema).extend({
  personId: uuidSchema,
  type: z.string().max(50),
  value: z.string().max(255),
  weight: z.number().int().min(-10).max(10).default(1),
});

export const nutritionGoalSchema = baseEntitySchema.merge(createdBySchema).extend({
  personId: uuidSchema,
  metric: z.string().max(100),
  targetMin: z.number().positive().nullable().optional(),
  targetMax: z.number().positive().nullable().optional(),
  period: z.enum(["meal", "day", "week"]).default("day"),
  rationale: z.string().max(100).nullable().optional(),
  activeFrom: z.string().date().nullable().optional(),
  activeUntil: z.string().date().nullable().optional(),
});

export type Sex = z.infer<typeof sexSchema>;
export type RuleKind = z.infer<typeof ruleKindSchema>;
export type Severity = z.infer<typeof severitySchema>;
export type SharedFacility = z.infer<typeof sharedFacilitySchema>;
export type Person = z.infer<typeof personSchema>;
export type PersonRule = z.infer<typeof personRuleSchema>;
export type PersonLabelNote = z.infer<typeof personLabelNoteSchema>;
export type Preference = z.infer<typeof preferenceSchema>;
export type NutritionGoal = z.infer<typeof nutritionGoalSchema>;
