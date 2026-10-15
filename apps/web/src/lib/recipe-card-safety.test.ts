import { describe, expect, it } from "vitest";
import { testPerson, testPersonRule } from "@/test/fixtures";
import { loveTagText, recipeSafetySummary } from "./recipe-card-safety";

describe("recipeSafetySummary", () => {
  const child = testPerson({
    id: "00000000-0000-4000-8000-000000000013",
    displayName: "Child C",
  });
  const parent = testPerson({ displayName: "Parent A" });
  const treeNut = testPersonRule({
    personId: child.id,
    target: "tree_nut",
    severity: "block",
    sharedFacility: "block",
    includeCrossContact: true,
    includeMayContain: true,
    includeDescendants: true,
  });

  it("names Child C's pine-nut block on pesto pasta", () => {
    const safety = recipeSafetySummary({
      people: [parent, child],
      rules: [treeNut],
      ingredients: [{ id: "pesto", name: "1/3 cup basil pesto" }],
    });
    expect(safety.blockPersonIds).toEqual([child.id]);
    expect(safety.warnPersonIds).toEqual([]);
    expect(safety.warnings[0]).toMatch(/pine nuts/i);
    expect(safety.warnings[0]).toMatch(/Child C can't eat this/);
  });
});

describe("loveTagText", () => {
  const hit = {
    personId: "child-c",
    personName: "Child C",
    tag: "Child C loves this",
  };

  it("drops a love when that person can't eat the recipe", () => {
    expect(loveTagText(hit, { blockPersonIds: ["child-c"], warnPersonIds: [] })).toBeNull();
  });

  it("qualifies a love when that person has a warning, not a block", () => {
    expect(loveTagText(hit, { blockPersonIds: [], warnPersonIds: ["child-c"] })).toBe(
      "Child C loves this - check first"
    );
  });

  it("keeps a love when there is no conflict", () => {
    expect(loveTagText(hit, { blockPersonIds: [], warnPersonIds: [] })).toBe("Child C loves this");
  });
});
