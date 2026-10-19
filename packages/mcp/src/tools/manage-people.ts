import { z } from "zod";
import type { AuthContext } from "../auth/index";
import { requireAdminRole } from "../auth/index";
import { PeopleService } from "@ovenlovin/core";
import { createDbClient } from "@ovenlovin/db";
import { McpInvalidParamsError } from "../json-rpc";

export const managePeopleSchema = z
  .object({
    action: z.enum(["list", "create", "update", "delete"]),
    personId: z.string().uuid().optional(),
    displayName: z.string().min(1).max(255).optional(),
    notes: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.action === "create" && !value.displayName?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["displayName"],
        message: "displayName is required to create a person",
      });
    }
    if ((value.action === "update" || value.action === "delete") && !value.personId) {
      ctx.addIssue({
        code: "custom",
        path: ["personId"],
        message: "personId is required",
      });
    }
  });

async function handler(input: z.infer<typeof managePeopleSchema>, context: AuthContext) {
  if (input.action === "update" || input.action === "delete") {
    if (!context.apiKeyId) requireAdminRole(context);
  }
  const db = createDbClient(process.env.DATABASE_URL!);
  const people = new PeopleService(db);
  const actor = context.userId ?? context.apiKeyId ?? context.householdId;

  if (input.action === "list") {
    const result = await people.listPeopleByHousehold(context.householdId, { limit: 100 });
    return {
      people: result.items.map((person) => ({
        id: person.id,
        displayName: person.displayName,
        sortOrder: person.sortOrder,
      })),
    };
  }

  if (input.action === "create") {
    if (!input.displayName) {
      throw new McpInvalidParamsError("displayName is required to create a person");
    }
    const created = await people.createPerson({
      householdId: context.householdId,
      displayName: input.displayName,
      notes: input.notes ?? null,
      createdBy: actor,
    });
    return {
      person: { id: created.id, displayName: created.displayName },
      status: "created" as const,
    };
  }

  if (!input.personId) throw new McpInvalidParamsError("personId is required");
  const person = await people.getPerson(input.personId);
  if (!person || person.householdId !== context.householdId) {
    throw new Error(`Person not found: ${input.personId}`);
  }

  if (input.action === "update") {
    const updated = await people.updatePerson(person.id, {
      displayName: input.displayName,
      notes: input.notes,
    });
    return {
      person: { id: person.id, displayName: updated?.displayName ?? person.displayName },
      status: "updated" as const,
    };
  }

  await people.deletePerson(person.id);
  return { id: person.id, status: "deleted" as const };
}

export const managePeopleTool = {
  name: "manage_people",
  description: "List, create, update, or delete people in this household.",
  inputSchema: managePeopleSchema,
  handler,
} as const;
