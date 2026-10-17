import { z } from "zod";
import type { AuthContext } from "../auth/index";
import { InviteService, invitePath } from "@ovenlovin/core";
import { createDbClient } from "@ovenlovin/db";
import { requireAdminRole } from "../auth/index";

export const manageKitchenInvitesSchema = z.object({
  action: z.enum(["list", "create", "revoke"]),
  role: z.enum(["admin", "member", "viewer"]).optional(),
  expiresInDays: z.number().int().min(1).max(30).optional(),
  inviteId: z.string().uuid().optional(),
});

function actorRole(context: AuthContext) {
  if (context.apiKeyId) return "admin" as const;
  return context.membershipRole ?? "member";
}

function actorUserId(context: AuthContext): string {
  const id = context.userId ?? context.apiKeyCreatedBy ?? context.householdId;
  return id;
}

async function handler(input: z.infer<typeof manageKitchenInvitesSchema>, context: AuthContext) {
  if (!context.apiKeyId) {
    requireAdminRole(context);
  }
  const db = createDbClient(process.env.DATABASE_URL!);
  const invites = new InviteService(db);
  const role = actorRole(context);

  if (input.action === "list") {
    const items = await invites.listPendingInvites(context.householdId, role);
    return {
      invites: items.map((invite) => ({
        id: invite.id,
        role: invite.role,
        expiresAt: invite.expiresAt,
        token: invite.token,
        path: invitePath(invite.token),
      })),
    };
  }

  if (input.action === "create") {
    const invite = await invites.createInvite(
      context.householdId,
      { role: input.role ?? "member", expiresInDays: input.expiresInDays ?? 7 },
      { userId: actorUserId(context), role }
    );
    return {
      invite: {
        id: invite.id,
        role: invite.role,
        expiresAt: invite.expiresAt,
        token: invite.token,
        path: invitePath(invite.token),
      },
      status: "created" as const,
    };
  }

  if (!input.inviteId) throw new Error("inviteId is required to revoke an invite");
  const revoked = await invites.revokeInvite(input.inviteId, context.householdId, role);
  return { id: revoked.id, status: "revoked" as const };
}

export const manageKitchenInvitesTool = {
  name: "manage_kitchen_invites",
  description:
    "Create, list, or revoke shareable kitchen invite links. Owner or admin. Default role is member. Email is not sent; share the returned path.",
  inputSchema: manageKitchenInvitesSchema,
  handler,
} as const;
