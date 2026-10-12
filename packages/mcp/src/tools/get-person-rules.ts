/**
 * Tool: get_person_rules
 *
 * Get detailed rules for one or more people
 */

import { z } from "zod";
import type { AuthContext } from "../auth/index";

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
    labelNotes?: Array<{
      note: string;
      ingredientName?: string;
      category?: string;
    }>;
  }>;
}

async function handler(
  _input: GetPersonRulesInput,
  _context: AuthContext
): Promise<GetPersonRulesOutput> {
  // TODO: Implement using @ovenlovin/core service
  // - Fetch people by IDs
  // - Get their rules with full details
  // - Return structured rule data

  return {
    people: [],
  };
}

export const getPersonRulesTool = {
  name: "get_person_rules",
  description:
    "Get detailed per-person rules including allergies, dietary restrictions, and preferences with severities and options. Use this for detailed rule inspection.",
  inputSchema: getPersonRulesSchema,
  handler,
} as const;
