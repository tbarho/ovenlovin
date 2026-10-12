import { z } from "zod";
import { baseEntitySchema, uuidSchema } from "./common";

export const allergenSchema = baseEntitySchema.extend({
  code: z.string().min(1).max(100),
  name: z.string().min(1).max(255),
  parentId: uuidSchema.nullable().optional(),
  description: z.string().nullable().optional(),
});

export type Allergen = z.infer<typeof allergenSchema>;
