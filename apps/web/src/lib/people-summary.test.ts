import { describe, expect, it } from "vitest";
import { testPerson, testPersonRule } from "@/test/fixtures";
import { summarizePeople } from "./people-summary";

describe("people summary", () => {
  it("names severe allergen blocks and skipped prefers", () => {
    const child = testPerson({
      id: "00000000-0000-4000-8000-000000000012",
      displayName: "Child B",
    });
    const parent = testPerson({ displayName: "Parent A" });
    const summary = summarizePeople(
      [parent, child],
      [
        testPersonRule({
          personId: child.id,
          target: "peanut",
          kind: "allergen",
          severity: "block",
        }),
        testPersonRule({
          id: "00000000-0000-4000-8000-000000000013",
          personId: child.id,
          target: "tree_nut",
          kind: "allergen",
          severity: "block",
        }),
        testPersonRule({
          id: "00000000-0000-4000-8000-000000000014",
          personId: parent.id,
          target: "mushrooms",
          kind: "ingredient",
          severity: "prefer_avoid",
        }),
      ]
    );
    expect(summary.line).toMatch(/peanuts/i);
    expect(summary.line).toMatch(/tree nuts/i);
    expect(summary.line).not.toMatch(/mushroom/i);
    expect(summary.severeCount).toBe(1);
    expect(summary.badge).toMatch(/1 severe allergy/);
  });
});
