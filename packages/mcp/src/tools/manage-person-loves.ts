/**
 * Tool: manage_person_loves
 *
 * Add, remove, or list per-person Loves. Loves never filter recipes;
 * they boost ranking and show “{Name} loves this” tags.
 */

import { z } from "zod";
import type { AuthContext } from "../auth/index";
import { PeopleService } from "@ovenlovin/core";
import { createDbClient } from "@ovenlovin/db";
import { LOVE_PREFERENCE_TYPE, loveLabel } from "@ovenlovin/allergens";

export const managePersonLovesSchema = z.object({
  action: z.enum(["list", "add", "remove"]),
  personId: z.string().uuid().describe("Person whose Loves list to change"),
  value: z
    .string()
    .min(1)
    .max(255)
    .optional()
    .describe("Food, ingredient, cuisine, or style (required for add)"),
  id: z.string().uuid().optional().describe("Preference id (required for remove)"),
  weight: z.number().int().min(1).max(10).optional().describe("Ranking weight, default 1"),
});

export type ManagePersonLovesInput = z.infer<typeof managePersonLovesSchema>;

async function handler(input: ManagePersonLovesInput, context: AuthContext) {
  const db = createDbClient(process.env.DATABASE_URL!);
  const people = new PeopleService(db);

  const person = await people.getPerson(input.personId);
  if (!person || person.householdId !== context.householdId) {
    throw new Error(`Person not found: ${input.personId}`);
  }

  if (input.action === "list") {
    const loves = await people.getPreferencesForPerson(person.id, LOVE_PREFERENCE_TYPE);
    return {
      personId: person.id,
      displayName: person.displayName,
      loves: loves.map((item) => ({
        id: item.id,
        value: item.value,
        label: loveLabel(item.value),
        weight: item.weight,
      })),
    };
  }

  if (input.action === "add") {
    if (!input.value?.trim()) throw new Error("value is required to add a love");
    const created = await people.createPreference({
      personId: person.id,
      type: LOVE_PREFERENCE_TYPE,
      value: input.value.trim(),
      weight: input.weight ?? 1,
      createdBy: context.userId ?? context.apiKeyId ?? context.householdId,
    });
    return {
      personId: person.id,
      displayName: person.displayName,
      status: "added" as const,
      love: {
        id: created.id,
        value: created.value,
        label: loveLabel(created.value),
        weight: created.weight,
      },
    };
  }

  if (!input.id) throw new Error("id is required to remove a love");
  const existing = await people.getPreference(input.id);
  if (!existing || existing.personId !== person.id) {
    throw new Error(`Love not found: ${input.id}`);
  }
  await people.deletePreference(input.id);
  return {
    personId: person.id,
    displayName: person.displayName,
    status: "removed" as const,
    id: input.id,
  };
}

export const managePersonLovesTool = {
  name: "manage_person_loves",
  description:
    "List, add, or remove a person's Loves (foods, ingredients, cuisines, styles). Loves never hide recipes; they boost meal-planner ranking and show “Name loves this” on matching dishes.",
  inputSchema: managePersonLovesSchema,
  handler,
} as const;
