import { z } from "zod";
import { baseEntitySchema, createdBySchema, uuidSchema } from "./common";

export const membershipRoleSchema = z.enum(["owner", "admin", "member", "viewer"]);

export const defaultServingsModeSchema = z.enum(["family", "fixed", "recipe"]);

/** Matches `clampServings` / `servingsRangeMax` so REST, MCP, and settings agree. */
export const SERVINGS_HARD_MAX = 99;

export const householdSchema = baseEntitySchema.merge(createdBySchema).extend({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(255),
  clerkOrgId: z.string().max(255).nullable().optional(),
  defaultServingsMode: defaultServingsModeSchema.default("family"),
  defaultServingsCount: z.number().int().min(1).max(SERVINGS_HARD_MAX).nullable().optional(),
});

export const householdServingsSettingsSchema = z.object({
  mode: defaultServingsModeSchema,
  servings: z.number().int().min(1).max(SERVINGS_HARD_MAX).nullable(),
  familySize: z.number().int().nonnegative(),
  defaultCookFor: z.number().int().min(1).max(SERVINGS_HARD_MAX),
});

export const updateHouseholdServingsSettingsSchema = z
  .object({
    mode: defaultServingsModeSchema,
    servings: z.number().int().min(1).max(SERVINGS_HARD_MAX).optional().nullable(),
  })
  .superRefine((value, ctx) => {
    if (value.mode === "fixed" && !(value.servings && value.servings > 0)) {
      ctx.addIssue({
        code: "custom",
        path: ["servings"],
        message: `Provide servings (1-${SERVINGS_HARD_MAX}) when Default servings is a fixed number.`,
      });
    }
  });

export const updateHouseholdNameSchema = z.object({
  name: z.string().trim().min(1).max(255),
});

export const replaceScheduleBodySchema = z.object({
  week: z.array(z.unknown()).max(14),
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

export const publicApiKeySchema = apiKeySchema.omit({ keyHash: true });

export const publicApiKeyWithPlaintextSchema = publicApiKeySchema.extend({
  plaintext: z.string(),
});

export const inviteRoleSchema = z.enum(["admin", "member", "viewer"]);

export const inviteStatusSchema = z.enum(["pending", "expired", "revoked"]);

export const householdInviteSchema = baseEntitySchema.merge(createdBySchema).extend({
  householdId: uuidSchema,
  token: z.string().min(16).max(255),
  role: inviteRoleSchema,
  expiresAt: z.string().datetime(),
  revokedAt: z.string().datetime().nullable().optional(),
});

export const createInviteInputSchema = z.object({
  role: inviteRoleSchema.optional().default("member"),
  expiresInDays: z.number().int().min(1).max(30).optional().default(7),
});

export const householdMemberSchema = z.object({
  membershipId: uuidSchema,
  userId: uuidSchema,
  email: z.string().email(),
  displayName: z.string().max(255).nullable(),
  role: membershipRoleSchema,
  createdAt: z.string().datetime(),
});

export const householdInvitePreviewSchema = z.object({
  householdId: uuidSchema,
  householdName: z.string(),
  role: inviteRoleSchema,
  expiresAt: z.string().datetime(),
  status: inviteStatusSchema,
});

export const userHouseholdSchema = z.object({
  household: householdSchema,
  membership: membershipSchema,
});

export type DefaultServingsMode = z.infer<typeof defaultServingsModeSchema>;
export type HouseholdServingsSettings = z.infer<typeof householdServingsSettingsSchema>;
export type UpdateHouseholdServingsSettings = z.infer<typeof updateHouseholdServingsSettingsSchema>;
export type UpdateHouseholdName = z.infer<typeof updateHouseholdNameSchema>;
export type MembershipRole = z.infer<typeof membershipRoleSchema>;
export type InviteRole = z.infer<typeof inviteRoleSchema>;
export type InviteStatus = z.infer<typeof inviteStatusSchema>;
export type Household = z.infer<typeof householdSchema>;
export type User = z.infer<typeof userSchema>;
export type Membership = z.infer<typeof membershipSchema>;
export type HouseholdInvite = z.infer<typeof householdInviteSchema>;
export type CreateInviteInput = z.infer<typeof createInviteInputSchema>;
export type HouseholdMember = z.infer<typeof householdMemberSchema>;
export type HouseholdInvitePreview = z.infer<typeof householdInvitePreviewSchema>;
export type UserHousehold = z.infer<typeof userHouseholdSchema>;
export type ApiKeyScope = z.infer<typeof apiKeyScopeSchema>;
export type ApiKey = z.infer<typeof apiKeySchema>;
export type CreateApiKeyInput = z.infer<typeof createApiKeyInputSchema>;
export type ApiKeyWithPlaintext = z.infer<typeof apiKeyWithPlaintextSchema>;
export type PublicApiKey = z.infer<typeof publicApiKeySchema>;
export type PublicApiKeyWithPlaintext = z.infer<typeof publicApiKeyWithPlaintextSchema>;

export function toPublicApiKey(key: ApiKey): PublicApiKey {
  return publicApiKeySchema.parse(key);
}

export function toPublicApiKeyWithPlaintext(key: ApiKeyWithPlaintext): PublicApiKeyWithPlaintext {
  return publicApiKeyWithPlaintextSchema.parse(key);
}
