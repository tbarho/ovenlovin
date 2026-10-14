import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { commonFields } from "./common";
import { apiKey, household, user } from "./households";

/**
 * Per-visitor demo sandbox. Only used when OVENLOVIN_DEMO_MODE is on.
 * Product production never writes this table.
 */
export const demoSandbox = pgTable("demo_sandbox", {
  ...commonFields,
  householdId: uuid("household_id")
    .notNull()
    .references(() => household.id),
  userId: uuid("user_id")
    .notNull()
    .references(() => user.id),
  apiKeyId: uuid("api_key_id").references(() => apiKey.id),
  apiKeyPlaintext: text("api_key_plaintext").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  writeCount: integer("write_count").notNull().default(0),
  importCount: integer("import_count").notNull().default(0),
  windowStartedAt: timestamp("window_started_at", { withTimezone: true }).notNull().defaultNow(),
  writesInWindow: integer("writes_in_window").notNull().default(0),
});
