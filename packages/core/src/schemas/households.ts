import { z } from "zod";
import { baseEntitySchema, createdBySchema, uuidSchema } from "./common";

export const membershipRoleSchema = z.enum(["owner", "admin", "member", "viewer"]);

export const householdSchema = baseEntitySchema.merge(createdBySchema).extend({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(255),
  clerkOrgId: z.string().max(255).nullable().optional(),
});

export const userSchema = baseEntitySchema.extend({
  clerkUserId: z.string().max(255),
  email: z.string().email().max(255),
  displayName: z.string().max(255).nullable().optional(),
});

export const membershipSchema = baseEntitySchema.extend({
  userId: uuidSchema,
  householdId: uuidSchema,
  role: membershipRoleSchema,
});

export type MembershipRole = z.infer<typeof membershipRoleSchema>;
export type Household = z.infer<typeof householdSchema>;
export type User = z.infer<typeof userSchema>;
export type Membership = z.infer<typeof membershipSchema>;
