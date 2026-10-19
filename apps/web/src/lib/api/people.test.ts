import { describe, expect, it } from "vitest";
import { NotFoundError } from "./errors";
import { assertPersonHousehold } from "./people";

describe("assertPersonHousehold", () => {
  it("404s when the person is in another kitchen", () => {
    expect(() =>
      assertPersonHousehold({ householdId: "kitchen-a" }, "kitchen-b", "person-1")
    ).toThrow(NotFoundError);
    expect(() => assertPersonHousehold(null, "kitchen-b", "person-1")).toThrow(NotFoundError);
  });

  it("allows a person in the caller's kitchen", () => {
    expect(() => assertPersonHousehold({ householdId: "kitchen-a" }, "kitchen-a")).not.toThrow();
  });
});
