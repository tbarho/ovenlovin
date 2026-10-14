/**
 * Tool: check_meal_plan
 *
 * Check a meal plan against household rules and schedule constraints
 */

import { z } from "zod";
import type { AuthContext } from "../auth/index";
import { RecipeService, PeopleService } from "@ovenlovin/core";
import { createDbClient, recipeIngredient } from "@ovenlovin/db";
import { eq, and, isNull } from "drizzle-orm";
import {
  LOVE_PREFERENCE_TYPE,
  checkIngredientsAgainstRules,
  lovesForRecipe,
  type PersonLove,
  type RuleCheckContext,
  type IngredientCheckInput,
} from "@ovenlovin/allergens";

export const checkMealPlanSchema = z.object({
  plan: z.object({
    weekStart: z.string().date(),
    entries: z.array(
      z.object({
        date: z.string().date(),
        meal: z.string(),
        recipeId: z.string().uuid(),
        servings: z.number().int().positive(),
        attendees: z.array(z.string()),
      })
    ),
  }),
});

export type CheckMealPlanInput = z.infer<typeof checkMealPlanSchema>;

export interface CheckMealPlanOutput {
  status: "complete" | "incomplete";
  overallSummary: {
    totalEntries: number;
    blockingIssues: number;
    warnings: number;
    preferAvoidances: number;
  };
  entries: Array<{
    date: string;
    meal: string;
    recipeTitle: string;
    findings: Array<{
      personId: string;
      personName: string;
      ruleId: string;
      severity: "block" | "warn" | "prefer_avoid";
      message: string;
      evidence: {
        ingredient: string;
        matchType: "contains" | "may_contain" | "cross_contact" | "derived_from";
        confidence: number;
      };
    }>;
    scheduleIssues?: Array<{
      type: "time_budget" | "method_mismatch" | "attendance";
      message: string;
    }>;
    loveTags?: string[];
  }>;
  nutritionSummary?: {
    coverage: string;
    notes: string[];
  };
  incompleteReason?: string;
}

async function handler(
  input: CheckMealPlanInput,
  context: AuthContext
): Promise<CheckMealPlanOutput> {
  const db = createDbClient(process.env.DATABASE_URL!);
  const recipeService = new RecipeService(db);
  const peopleService = new PeopleService(db);

  const attendeeIds = [...new Set(input.plan.entries.flatMap((entry) => entry.attendees))];
  const attendeePeople = await Promise.all(
    attendeeIds.map(async (personId) => {
      const person = await peopleService.getPerson(personId);
      if (!person || person.householdId !== context.householdId) return null;
      return person;
    })
  );
  const knownPeople = attendeePeople.filter((person): person is NonNullable<typeof person> =>
    Boolean(person)
  );
  const attendeeLoves = await peopleService.getPreferencesForPeople(
    knownPeople.map((person) => person.id),
    LOVE_PREFERENCE_TYPE
  );
  const lovePeople: PersonLove[] = attendeeLoves.map((pref) => {
    const person = knownPeople.find((item) => item.id === pref.personId);
    return {
      personId: pref.personId,
      personName: person?.displayName ?? "Someone",
      preference: pref,
    };
  });

  const entriesResults = await Promise.all(
    input.plan.entries.map(async (entry) => {
      // Load recipe
      const recipe = await recipeService.getRecipe(entry.recipeId);
      if (!recipe) {
        return {
          date: entry.date,
          meal: entry.meal,
          recipeTitle: "[Recipe not found]",
          findings: [],
          scheduleIssues: [
            {
              type: "attendance" as const,
              message: `Recipe ${entry.recipeId} not found`,
            },
          ],
        };
      }

      // Verify recipe belongs to the household
      if (recipe.householdId !== context.householdId) {
        throw new Error(`Unauthorized access to recipe: ${entry.recipeId}`);
      }

      // Load recipe ingredients
      const ingredientRows = await db
        .select()
        .from(recipeIngredient)
        .where(
          and(eq(recipeIngredient.recipeId, entry.recipeId), isNull(recipeIngredient.deletedAt))
        );

      const ingredients: IngredientCheckInput[] = ingredientRows.map((ing) => ({
        name: ing.rawText,
        ingredientId: ing.ingredientId ?? undefined,
        confidence: ing.parseConfidence ? Number(ing.parseConfidence) : undefined,
      }));

      // Load attendee rules
      const contexts: RuleCheckContext[] = [];
      for (const personId of entry.attendees) {
        const person = await peopleService.getPerson(personId);
        if (!person) continue;

        // Verify person belongs to the household
        if (person.householdId !== context.householdId) {
          throw new Error(`Unauthorized access to person: ${personId}`);
        }

        const rules = await peopleService.getRulesForPerson(personId);
        for (const rule of rules) {
          // Only check active rules
          const now = new Date();
          if (rule.activeFrom && new Date(rule.activeFrom) > now) continue;
          if (rule.activeUntil && new Date(rule.activeUntil) < now) continue;

          contexts.push({
            personId: person.id,
            personName: person.displayName,
            rule,
          });
        }
      }

      // Run rule checker
      const checkResult =
        contexts.length > 0 && ingredients.length > 0
          ? checkIngredientsAgainstRules(ingredients, contexts)
          : { status: "complete" as const, findings: { block: [], warn: [], prefer_avoid: [] } };

      // Convert findings to output format
      const findings: CheckMealPlanOutput["entries"][0]["findings"] = [];

      for (const finding of checkResult.findings.block) {
        findings.push({
          personId: finding.personId,
          personName: finding.personName,
          ruleId: finding.ruleId,
          severity: "block",
          message: finding.message,
          evidence: {
            ingredient: finding.ingredientName,
            matchType:
              finding.relation === "commonly_cross_contact" ? "cross_contact" : finding.relation,
            confidence: finding.confidence,
          },
        });
      }

      for (const finding of checkResult.findings.warn) {
        findings.push({
          personId: finding.personId,
          personName: finding.personName,
          ruleId: finding.ruleId,
          severity: "warn",
          message: finding.message,
          evidence: {
            ingredient: finding.ingredientName,
            matchType:
              finding.relation === "commonly_cross_contact" ? "cross_contact" : finding.relation,
            confidence: finding.confidence,
          },
        });
      }

      for (const finding of checkResult.findings.prefer_avoid) {
        findings.push({
          personId: finding.personId,
          personName: finding.personName,
          ruleId: finding.ruleId,
          severity: "prefer_avoid",
          message: finding.message,
          evidence: {
            ingredient: finding.ingredientName,
            matchType:
              finding.relation === "commonly_cross_contact" ? "cross_contact" : finding.relation,
            confidence: finding.confidence,
          },
        });
      }

      const loveHits = lovesForRecipe(
        {
          title: recipe.title,
          description: recipe.description,
          cuisine: recipe.cuisine,
          course: recipe.course,
          methodTags: recipe.methodTags,
          ingredients: ingredientRows.map((row) => ({ rawText: row.rawText })),
        },
        lovePeople
      );

      return {
        date: entry.date,
        meal: entry.meal,
        recipeTitle: recipe.title,
        findings,
        loveTags:
          loveHits.length > 0 ? [...new Set(loveHits.map((hit) => hit.tag))] : undefined,
      };
    })
  );

  // Calculate summary
  const overallSummary = {
    totalEntries: entriesResults.length,
    blockingIssues: entriesResults.reduce(
      (sum, entry) => sum + entry.findings.filter((f) => f.severity === "block").length,
      0
    ),
    warnings: entriesResults.reduce(
      (sum, entry) => sum + entry.findings.filter((f) => f.severity === "warn").length,
      0
    ),
    preferAvoidances: entriesResults.reduce(
      (sum, entry) => sum + entry.findings.filter((f) => f.severity === "prefer_avoid").length,
      0
    ),
  };

  return {
    status: "complete",
    overallSummary,
    entries: entriesResults,
  };
}

export const checkMealPlanTool = {
  name: "check_meal_plan",
  description:
    "Check a meal plan against per-person rules and schedule constraints. Returns per-entry, per-person findings by severity, plus informational loveTags (never a filter). MUST be called before saving a plan.",
  inputSchema: checkMealPlanSchema,
  handler,
} as const;
