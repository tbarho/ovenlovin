import { pgTable, varchar, uuid, text } from "drizzle-orm/pg-core";
import { commonFields } from "./common";

export const allergen = pgTable("allergen", {
  ...commonFields,
  code: varchar("code", { length: 100 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  parentId: uuid("parent_id"),
  description: text("description"),
});
