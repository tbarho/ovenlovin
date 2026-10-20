import { z } from "zod";
import type { AuthContext } from "../auth/index";
import { requireWriteRole } from "../auth/index";
import { HouseholdService } from "@ovenlovin/core";
import { createDbClient } from "@ovenlovin/db";

export const manageKitchenMembersSchema = z.object({
  action: z.enum(["list", "update_role", "remove", "leave"]),
  userId: z.string().uuid().optional(),
  role: z.enum(["owner", "admin", "member", "viewer"]).optional(),
});

function actorRole(context: AuthContext) {
  return context.membershipRole ?? "member";
}

function actorUserId(context: AuthContext): string {
  const id = context.userId ?? context.apiKeyCreatedBy;
  if (!id) throw new Error("A signed-in user is required for this kitchen member action.");
  return id;
}

async function handler(input: z.infer<typeof manageKitchenMembersSchema>, context: AuthContext) {
  const db = createDbClient(process.env.DATABASE_URL!);
  const households = new HouseholdService(db);

  if (input.action === "list") {
    const members = await households.listMembers(context.householdId);
    return {
      members: members.map((member) => ({
        userId: member.userId,
        displayName: member.displayName,
        email: member.email,
        role: member.role,
      })),
    };
  }

  if (input.action === "leave") {
    await households.leaveHousehold({
      householdId: context.householdId,
      userId: actorUserId(context),
    });
    return { status: "left" as const, householdId: context.householdId };
  }

  requireWriteRole(context);
  if (!input.userId) throw new Error("userId is required");

  if (input.action === "update_role") {
    if (!input.role) throw new Error("role is required to update a member");
    const membership = await households.updateMemberRole({
      householdId: context.householdId,
      targetUserId: input.userId,
      role: input.role,
      actorUserId: actorUserId(context),
      actorRole: actorRole(context),
    });
    return { userId: membership.userId, role: membership.role, status: "updated" as const };
  }

  await households.removeMember({
    householdId: context.householdId,
    targetUserId: input.userId,
    actorUserId: actorUserId(context),
    actorRole: actorRole(context),
  });
  return { userId: input.userId, status: "removed" as const };
}

export const manageKitchenMembersTool = {
  name: "manage_kitchen_members",
  description:
    "List kitchen members, change roles (owner), remove a member (owner), or leave the kitchen. People (dietary profiles) are separate from kitchen members.",
  inputSchema: manageKitchenMembersSchema,
  handler,
} as const;
