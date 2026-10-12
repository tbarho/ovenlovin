import { pgTable, varchar, uuid, pgEnum, text, timestamp } from "drizzle-orm/pg-core";
import { commonFields, createdByField } from "./common";

export const membershipRoleEnum = pgEnum("membership_role", ["owner", "admin", "member", "viewer"]);

export const household = pgTable("household", {
  ...commonFields,
  ...createdByField,
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  clerkOrgId: varchar("clerk_org_id", { length: 255 }).unique(),
});

export const user = pgTable("user", {
  ...commonFields,
  clerkUserId: varchar("clerk_user_id", { length: 255 }).notNull().unique(),
  email: varchar("email", { length: 255 }).notNull(),
  displayName: varchar("display_name", { length: 255 }),
});

export const membership = pgTable("membership", {
  ...commonFields,
  userId: uuid("user_id")
    .notNull()
    .references(() => user.id),
  householdId: uuid("household_id")
    .notNull()
    .references(() => household.id),
  role: membershipRoleEnum("role").notNull().default("member"),
});

export const apiKey = pgTable("api_key", {
  ...commonFields,
  ...createdByField,
  householdId: uuid("household_id")
    .notNull()
    .references(() => household.id),
  name: varchar("name", { length: 255 }).notNull(),
  keyHash: varchar("key_hash", { length: 255 }).notNull(),
  keyPrefix: varchar("key_prefix", { length: 16 }).notNull(),
  scopes: text("scopes")
    .array()
    .notNull()
    .default([]),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
});
