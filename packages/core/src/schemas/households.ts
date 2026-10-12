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

export const apiKeyScopeSchema = z.enum([
  "recipes:read",
  "recipes:write",
  "plans:read",
  "plans:write",
  "people:read",
  "people:write",
  "lists:export",
]);

export const apiKeySchema = baseEntitySchema.merge(createdBySchema).extend({
  householdId: uuidSchema,
  name: z.string().min(1).max(255),
  keyHash: z.string().max(255),
  keyPrefix: z.string().max(16),
  scopes: z.array(apiKeyScopeSchema),
  lastUsedAt: z.string().datetime().nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  revokedAt: z.string().datetime().nullable().optional(),
});

export const createApiKeyInputSchema = z.object({
  householdId: uuidSchema,
  name: z.string().min(1).max(255),
  scopes: z.array(apiKeyScopeSchema).min(1),
  expiresAt: z.string().datetime().optional(),
});

export const apiKeyWithPlaintextSchema = apiKeySchema.extend({
  plaintext: z.string(),
});

export type MembershipRole = z.infer<typeof membershipRoleSchema>;
export type Household = z.infer<typeof householdSchema>;
export type User = z.infer<typeof userSchema>;
export type Membership = z.infer<typeof membershipSchema>;
export type ApiKeyScope = z.infer<typeof apiKeyScopeSchema>;
export type ApiKey = z.infer<typeof apiKeySchema>;
export type CreateApiKeyInput = z.infer<typeof createApiKeyInputSchema>;
export type ApiKeyWithPlaintext = z.infer<typeof apiKeyWithPlaintextSchema>;
