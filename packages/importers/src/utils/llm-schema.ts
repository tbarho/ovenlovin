import { z } from "zod";

/** Strict structured output fills unknown optionals with 0 / "" / null. */
export function optionalField<T extends z.ZodType>(schema: T) {
  return z
    .union([schema, z.null(), z.literal(""), z.literal(0)])
    .optional()
    .transform((value) => {
      if (value == null || value === "" || value === 0) return undefined;
      return value as z.output<T>;
    });
}
