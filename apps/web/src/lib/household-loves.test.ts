import { describe, expect, it } from "vitest";
import { qualifyLoveHits } from "./household-loves";

describe("qualifyLoveHits", () => {
  it("qualifies a love tag when that person has a recipe conflict", () => {
    const hits = qualifyLoveHits(
      [
        {
          personId: "parent-b",
          personName: "Parent B",
          value: "italian",
          label: "Italian",
          tag: "Parent B loves this",
        },
      ],
      ["parent-b"]
    );
    expect(hits[0]?.tag).toBe("Parent B loves this, but check first");
  });
});
