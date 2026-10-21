import { describe, expect, it } from "vitest";
import { z } from "zod";
import { optionalField } from "./llm-schema";

describe("optionalField", () => {
  const schema = z.object({
    servings: optionalField(z.number().positive()),
    notes: optionalField(z.string()),
  });

  it("keeps a real value", () => {
    expect(schema.parse({ servings: 4, notes: "salt the water" })).toEqual({
      servings: 4,
      notes: "salt the water",
    });
  });

  it("normalizes 0 / empty / null to unknown", () => {
    expect(schema.parse({ servings: 0, notes: "" })).toEqual({
      servings: undefined,
      notes: undefined,
    });
    expect(schema.parse({ servings: null, notes: 0 })).toEqual({
      servings: undefined,
      notes: undefined,
    });
  });
});
