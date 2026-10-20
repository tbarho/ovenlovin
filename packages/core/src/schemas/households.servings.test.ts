import { describe, expect, it } from "vitest";
import { updateHouseholdNameSchema, updateHouseholdServingsSettingsSchema } from "./households";

describe("updateHouseholdServingsSettingsSchema", () => {
  it("requires servings when the kitchen uses a fixed number", () => {
    expect(updateHouseholdServingsSettingsSchema.safeParse({ mode: "family" }).success).toBe(true);
    expect(updateHouseholdServingsSettingsSchema.safeParse({ mode: "recipe" }).success).toBe(true);
    expect(updateHouseholdServingsSettingsSchema.safeParse({ mode: "fixed" }).success).toBe(false);
    expect(
      updateHouseholdServingsSettingsSchema.safeParse({ mode: "fixed", servings: 8 }).success
    ).toBe(true);
    expect(
      updateHouseholdServingsSettingsSchema.safeParse({ mode: "fixed", servings: 48 }).success
    ).toBe(true);
    expect(
      updateHouseholdServingsSettingsSchema.safeParse({ mode: "fixed", servings: 100 }).success
    ).toBe(false);
  });
});

describe("updateHouseholdNameSchema", () => {
  it("trims and requires a kitchen name", () => {
    expect(updateHouseholdNameSchema.parse({ name: "  Weeknight kitchen  " }).name).toBe(
      "Weeknight kitchen"
    );
    expect(updateHouseholdNameSchema.safeParse({ name: "   " }).success).toBe(false);
    expect(updateHouseholdNameSchema.safeParse({ name: "" }).success).toBe(false);
  });
});
