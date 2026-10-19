import { describe, expect, it } from "vitest";
import { updateHouseholdServingsSettingsSchema } from "./households";

describe("updateHouseholdServingsSettingsSchema", () => {
  it("requires servings when the kitchen uses a fixed number", () => {
    expect(updateHouseholdServingsSettingsSchema.safeParse({ mode: "family" }).success).toBe(true);
    expect(updateHouseholdServingsSettingsSchema.safeParse({ mode: "recipe" }).success).toBe(true);
    expect(updateHouseholdServingsSettingsSchema.safeParse({ mode: "fixed" }).success).toBe(false);
    expect(
      updateHouseholdServingsSettingsSchema.safeParse({ mode: "fixed", servings: 8 }).success
    ).toBe(true);
  });
});
