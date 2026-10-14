/**
 * Tool: reorder_people
 *
 * Persist the household people order used by lists, who-can-eat, and pickers.
 */

import { z } from "zod";
import type { AuthContext } from "../auth/index";
import { PeopleOrderError, PeopleService } from "@ovenlovin/core";
import { createDbClient } from "@ovenlovin/db";

export const reorderPeopleSchema = z.object({
  personIds: z
    .array(z.string().uuid())
    .min(1)
    .describe("Every household person id, in the desired display order"),
});

export type ReorderPeopleInput = z.infer<typeof reorderPeopleSchema>;

async function handler(input: ReorderPeopleInput, context: AuthContext) {
  const db = createDbClient(process.env.DATABASE_URL!);
  const people = new PeopleService(db);

  try {
    const items = await people.reorderPeople(context.householdId, input.personIds);
    return {
      people: items.map((person, index) => ({
        id: person.id,
        displayName: person.displayName,
        sortOrder: person.sortOrder,
        position: index,
      })),
    };
  } catch (error) {
    if (error instanceof PeopleOrderError) throw error;
    throw error;
  }
}

export const reorderPeopleTool = {
  name: "reorder_people",
  description:
    "Set the persistent household people order. personIds must list every person exactly once. This order is used by people lists, who-can-eat, meal-planner attendees, and household context.",
  inputSchema: reorderPeopleSchema,
  handler,
} as const;
