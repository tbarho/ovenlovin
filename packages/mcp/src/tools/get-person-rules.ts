/**
 * Tool: get_person_rules
 *
 * Get detailed rules for one or more people
 */

import { z } from "zod";
import type { AuthContext } from "../auth/index";
import { PeopleService } from "@ovenlovin/core";
import { createDbClient } from "@ovenlovin/db";
import { LOVE_PREFERENCE_TYPE, loveLabel } from "@ovenlovin/allergens";

export const getPersonRulesSchema = z.object({
  personIds: z.array(z.string()).min(1).describe("Person IDs to get rules for"),
  includeInactive: z.boolean().default(false),
});

export type GetPersonRulesInput = z.infer<typeof getPersonRulesSchema>;

export interface GetPersonRulesOutput {
  people: Array<{
    id: string;
    displayName: string;
    rules: Array<{
      id: string;
      kind: "allergen" | "ingredient" | "ingredient_category" | "diet" | "tag" | "custom";
      target: string;
      severity: "block" | "warn" | "prefer_avoid";
      label?: string;
      note?: string;
      options: {
        includeMayContain: boolean;
        includeCrossContact: boolean;
        sharedFacility: "block" | "warn" | "ignore";
        includeDescendants: boolean;
        treatCoconutAsTreeNut?: boolean;
      };
    }>;
    loves: Array<{
      id: string;
      value: string;
      label: string;
      weight: number;
    }>;
    labelNotes?: Array<{
      note: string;
      ingredientName?: string;
      category?: string;
    }>;
  }>;
}

async function handler(
  input: GetPersonRulesInput,
  context: AuthContext
): Promise<GetPersonRulesOutput> {
  const db = createDbClient(process.env.DATABASE_URL!);
  const peopleService = new PeopleService(db);

  const people = await Promise.all(
    input.personIds.map(async (personId) => {
      const person = await peopleService.getPerson(personId);
      if (!person || person.householdId !== context.householdId) {
        throw new Error(`Person not found: ${personId}`);
      }

      const allRules = await peopleService.getRulesForPerson(personId);
      const loves = await peopleService.getPreferencesForPerson(personId, LOVE_PREFERENCE_TYPE);

      // Filter inactive rules if not requested
      const rules = input.includeInactive
        ? allRules
        : allRules.filter((rule) => {
            // Check if rule is currently active based on activeFrom/activeUntil
            const now = new Date();
            if (rule.activeFrom && new Date(rule.activeFrom) > now) {
              return false;
            }
            if (rule.activeUntil && new Date(rule.activeUntil) < now) {
              return false;
            }
            return true;
          });

      return {
        id: person.id,
        displayName: person.displayName,
        rules: rules.map((rule) => ({
          id: rule.id,
          kind: rule.kind,
          target: rule.target,
          severity: rule.severity,
          label: rule.label ?? undefined,
          note: rule.note ?? undefined,
          options: {
            includeMayContain: rule.includeMayContain,
            includeCrossContact: rule.includeCrossContact,
            sharedFacility: rule.sharedFacility,
            includeDescendants: rule.includeDescendants,
            treatCoconutAsTreeNut: rule.treatCoconutAsTreeNut ?? undefined,
          },
        })),
        loves: loves.map((item) => ({
          id: item.id,
          value: item.value,
          label: loveLabel(item.value),
          weight: item.weight,
        })),
      };
    })
  );

  return { people };
}

export const getPersonRulesTool = {
  name: "get_person_rules",
  description:
    "Get detailed per-person rules (Can't eat / Doesn't like) and Loves. Loves never filter recipes; they boost ranking. Use this for detailed rule inspection. Not medical advice - always check ingredient labels before serving.",
  inputSchema: getPersonRulesSchema,
  handler,
} as const;
