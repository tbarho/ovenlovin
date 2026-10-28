import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { household } from "./households";

/** Long-running household work (book import, book PDF), split into leased items. */
export const job = pgTable(
  "job",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => household.id),
    kind: varchar("kind", { length: 32 }).notNull(),
    status: varchar("status", { length: 16 }).notNull().default("queued"),
    input: jsonb("input").notNull().default({}),
    totalItems: integer("total_items").notNull().default(0),
    doneItems: integer("done_items").notNull().default(0),
    failedItems: integer("failed_items").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => ({
    householdStatus: index("job_household_status_idx").on(table.householdId, table.status),
  })
);

export const jobItem = pgTable(
  "job_item",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => job.id, { onDelete: "cascade" }),
    seq: integer("seq").notNull(),
    payload: jsonb("payload").notNull().default({}),
    status: varchar("status", { length: 16 }).notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    leaseUntil: timestamp("lease_until", { withTimezone: true }),
    result: jsonb("result"),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    jobSeq: uniqueIndex("job_item_job_seq_key").on(table.jobId, table.seq),
    claimable: index("job_item_status_lease_idx").on(table.status, table.leaseUntil),
  })
);
