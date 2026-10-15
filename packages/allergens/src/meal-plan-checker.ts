/**
 * Meal plan checker
 *
 * Check complete meal plans against all attendees' rules.
 * Returns per-person and per-entry findings grouped by severity.
 */

import type { PersonRule } from "@ovenlovin/core";
import {
  checkIngredientsAgainstRules,
  type RuleCheckContext,
  type IngredientCheckInput,
  type RuleCheckFinding,
} from "./rule-checker";

/**
 * A meal plan entry with recipe ingredients
 */
export interface MealPlanEntryInput {
  /** Entry ID */
  id: string;
  /** Date of the meal */
  date: string;
  /** Meal slot (breakfast, lunch, dinner, snack) */
  mealSlot: string;
  /** Recipe ID if using a recipe */
  recipeId?: string;
  /** Recipe title */
  recipeTitle?: string;
  /** Freeform meal description if not using a recipe */
  freeformMeal?: string;
  /** List of attendees (person IDs) */
  attendees: string[];
  /** Recipe ingredients */
  ingredients: IngredientCheckInput[];
}

/**
 * A person with their rules for checking
 */
export interface PersonWithRules {
  id: string;
  name: string;
  rules: PersonRule[];
}

/**
 * Meal plan check input
 */
export interface MealPlanCheckInput {
  /** Meal plan entries */
  entries: MealPlanEntryInput[];
  /** People with their rules */
  people: PersonWithRules[];
}

/**
 * Per-entry findings
 */
export interface EntryCheckResult {
  entryId: string;
  date: string;
  mealSlot: string;
  recipeTitle?: string;
  freeformMeal?: string;
  /** Findings for this entry, grouped by severity */
  findings: {
    block: RuleCheckFinding[];
    warn: RuleCheckFinding[];
    prefer_avoid: RuleCheckFinding[];
  };
  /** People affected by this entry */
  affectedPeople: string[];
}

/**
 * Per-person findings
 */
export interface PersonCheckResult {
  personId: string;
  personName: string;
  /** Findings for this person, grouped by severity */
  findings: {
    block: RuleCheckFinding[];
    warn: RuleCheckFinding[];
    prefer_avoid: RuleCheckFinding[];
  };
  /** Entries that affect this person */
  affectedEntries: string[];
}

/**
 * Complete meal plan check result
 */
export interface MealPlanCheckResult {
  /** Overall status */
  status: "complete" | "incomplete";
  /** Per-entry results */
  byEntry: EntryCheckResult[];
  /** Per-person results */
  byPerson: PersonCheckResult[];
  /** Summary counts */
  summary: {
    totalEntries: number;
    totalPeople: number;
    entriesWithBlocks: number;
    entriesWithWarnings: number;
    entriesWithPreferAvoid: number;
    peopleWithBlocks: number;
    peopleWithWarnings: number;
    peopleWithPreferAvoid: number;
  };
  /** Reasons if incomplete */
  incompleteReasons?: string[];
}

/**
 * Check a complete meal plan against all attendees' rules
 *
 * This is the main entry point for meal plan checking.
 * It checks each entry against each attendee's rules and returns:
 * - Per-entry findings (which entries have issues)
 * - Per-person findings (which people are affected)
 * - Summary statistics
 */
export function checkMealPlan(input: MealPlanCheckInput): MealPlanCheckResult {
  const byEntry: EntryCheckResult[] = [];
  const byPersonMap = new Map<string, PersonCheckResult>();
  const incompleteReasons: string[] = [];

  // Initialize per-person results
  for (const person of input.people) {
    byPersonMap.set(person.id, {
      personId: person.id,
      personName: person.name,
      findings: {
        block: [],
        warn: [],
        prefer_avoid: [],
      },
      affectedEntries: [],
    });
  }

  // Check each entry
  for (const entry of input.entries) {
    const entryResult: EntryCheckResult = {
      entryId: entry.id,
      date: entry.date,
      mealSlot: entry.mealSlot,
      recipeTitle: entry.recipeTitle,
      freeformMeal: entry.freeformMeal,
      findings: {
        block: [],
        warn: [],
        prefer_avoid: [],
      },
      affectedPeople: [],
    };

    // Find people attending this entry
    const attendingPeople = input.people.filter((p) => entry.attendees.includes(p.id));

    if (attendingPeople.length === 0) {
      // No attendees, skip
      continue;
    }

    const skipIngredientCheck = !entry.recipeId && Boolean(entry.freeformMeal);

    if (entry.ingredients.length === 0 && !skipIngredientCheck) {
      incompleteReasons.push(
        `Entry ${entry.id} (${entry.recipeTitle || entry.freeformMeal || "untitled"}) has no ingredients`
      );
    }

    // Build rule contexts for all attending people
    const contexts: RuleCheckContext[] = [];
    for (const person of attendingPeople) {
      for (const rule of person.rules) {
        contexts.push({
          personId: person.id,
          personName: person.name,
          rule,
        });
      }
    }

    const checkResult = skipIngredientCheck
      ? {
          status: "complete" as const,
          findings: { block: [], warn: [], prefer_avoid: [] },
          incompleteReasons: undefined,
        }
      : checkIngredientsAgainstRules(entry.ingredients, contexts);

    if (checkResult.status === "incomplete") {
      incompleteReasons.push(
        ...checkResult.incompleteReasons!.map(
          (r) =>
            `Entry ${entry.id} (${entry.recipeTitle || entry.freeformMeal || "untitled"}): ${r}`
        )
      );
    }

    // Add findings to entry result
    entryResult.findings.block.push(...checkResult.findings.block);
    entryResult.findings.warn.push(...checkResult.findings.warn);
    entryResult.findings.prefer_avoid.push(...checkResult.findings.prefer_avoid);

    // Track affected people for this entry
    const affectedPeopleIds = new Set<string>();
    for (const finding of [
      ...checkResult.findings.block,
      ...checkResult.findings.warn,
      ...checkResult.findings.prefer_avoid,
    ]) {
      affectedPeopleIds.add(finding.personId);
    }
    entryResult.affectedPeople = Array.from(affectedPeopleIds);

    // Add findings to per-person results
    for (const finding of checkResult.findings.block) {
      const personResult = byPersonMap.get(finding.personId);
      if (personResult) {
        personResult.findings.block.push(finding);
        if (!personResult.affectedEntries.includes(entry.id)) {
          personResult.affectedEntries.push(entry.id);
        }
      }
    }
    for (const finding of checkResult.findings.warn) {
      const personResult = byPersonMap.get(finding.personId);
      if (personResult) {
        personResult.findings.warn.push(finding);
        if (!personResult.affectedEntries.includes(entry.id)) {
          personResult.affectedEntries.push(entry.id);
        }
      }
    }
    for (const finding of checkResult.findings.prefer_avoid) {
      const personResult = byPersonMap.get(finding.personId);
      if (personResult) {
        personResult.findings.prefer_avoid.push(finding);
        if (!personResult.affectedEntries.includes(entry.id)) {
          personResult.affectedEntries.push(entry.id);
        }
      }
    }

    byEntry.push(entryResult);
  }

  const byPerson = Array.from(byPersonMap.values());

  // Calculate summary
  const summary = {
    totalEntries: input.entries.length,
    totalPeople: input.people.length,
    entriesWithBlocks: byEntry.filter((e) => e.findings.block.length > 0).length,
    entriesWithWarnings: byEntry.filter((e) => e.findings.warn.length > 0).length,
    entriesWithPreferAvoid: byEntry.filter((e) => e.findings.prefer_avoid.length > 0).length,
    peopleWithBlocks: byPerson.filter((p) => p.findings.block.length > 0).length,
    peopleWithWarnings: byPerson.filter((p) => p.findings.warn.length > 0).length,
    peopleWithPreferAvoid: byPerson.filter((p) => p.findings.prefer_avoid.length > 0).length,
  };

  return {
    status: incompleteReasons.length > 0 ? "incomplete" : "complete",
    byEntry,
    byPerson,
    summary,
    incompleteReasons: incompleteReasons.length > 0 ? incompleteReasons : undefined,
  };
}
