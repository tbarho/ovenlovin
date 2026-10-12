import { pgTable, varchar, uuid, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { commonFields, createdByField } from "./common";
import { household } from "./households";
import { user } from "./households";

export const shareResourceTypeEnum = pgEnum("share_resource_type", [
  "recipe",
  "collection",
  "meal_plan",
  "shopping_list",
]);

export const sharePermissionEnum = pgEnum("share_permission", ["view", "comment", "edit"]);

export const shareGranteeTypeEnum = pgEnum("share_grantee_type", ["household", "user", "public"]);

export const share = pgTable("share", {
  ...commonFields,
  ...createdByField,
  resourceType: shareResourceTypeEnum("resource_type").notNull(),
  resourceId: uuid("resource_id").notNull(),
  granteeType: shareGranteeTypeEnum("grantee_type").notNull(),
  granteeHouseholdId: uuid("grantee_household_id").references(() => household.id),
  granteeUserId: uuid("grantee_user_id").references(() => user.id),
  permission: sharePermissionEnum("permission").notNull(),
  token: varchar("token", { length: 255 }).unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
});
