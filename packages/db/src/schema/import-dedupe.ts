import { pgTable, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { household } from "./households";
import { recipe } from "./recipes";

/** In-flight and completed import locks (idempotency, photo hash, source URL). */
export const importDedupe = pgTable(
  "import_dedupe",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => household.id),
    kind: varchar("kind", { length: 32 }).notNull(),
    dedupeKey: varchar("dedupe_key", { length: 512 }).notNull(),
    status: varchar("status", { length: 16 }).notNull(),
    recipeId: uuid("recipe_id").references(() => recipe.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
  },
  (table) => ({
    householdKindKey: uniqueIndex("import_dedupe_household_kind_key").on(
      table.householdId,
      table.kind,
      table.dedupeKey
    ),
  })
);
