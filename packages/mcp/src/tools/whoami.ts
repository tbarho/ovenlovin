import { z } from "zod";
import type { AuthContext } from "../auth/index";
import { HouseholdService } from "@ovenlovin/core";
import { createDbClient } from "@ovenlovin/db";

export const whoamiSchema = z.object({
  verbose: z
    .boolean()
    .optional()
    .describe("Include household name when true (always included today)"),
});

async function handler(_input: z.infer<typeof whoamiSchema>, context: AuthContext) {
  const db = createDbClient(process.env.DATABASE_URL!);
  const household = await new HouseholdService(db).getHousehold(context.householdId);

  return {
    householdId: context.householdId,
    householdName: household?.name ?? null,
    userId: context.userId ?? null,
    apiKeyId: context.apiKeyId ?? null,
    scopes: context.scopes,
    membershipRole: context.membershipRole ?? null,
  };
}

export const whoamiTool = {
  name: "whoami",
  description:
    "Return the authenticated household, scopes, and key identity. Use this first to confirm you are talking to the right kitchen.",
  inputSchema: whoamiSchema,
  handler,
} as const;
