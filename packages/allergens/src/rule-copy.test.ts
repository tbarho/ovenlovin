import { describe, expect, it } from "vitest";
import {
  describeRuleChip,
  describeRuleSummary,
  personRemovalCopy,
  ruleRemovalCopy,
  severityPhrase,
} from "./rule-copy";

describe("describeRuleChip", () => {
  it("formats a blocking tree nut allergy", () => {
    expect(describeRuleChip({ kind: "allergen", target: "tree_nut", severity: "block" })).toEqual({
      text: "Allergic to tree nuts, blocks",
      severity: "block",
    });
  });

  it("formats a peanut block rule", () => {
    expect(describeRuleChip({ kind: "allergen", target: "peanut", severity: "block" }).text).toBe(
      "Allergic to peanuts, blocks"
    );
  });

  it("formats a prefer-avoid dairy rule", () => {
    expect(
      describeRuleChip({ kind: "allergen", target: "milk", severity: "prefer_avoid" })
    ).toEqual({
      text: "Avoids dairy, prefers to avoid",
      severity: "prefer_avoid",
    });
  });

  it("formats a warning allergy", () => {
    expect(describeRuleChip({ kind: "allergen", target: "sesame", severity: "warn" }).text).toBe(
      "Allergic to sesame, warns"
    );
  });

  it("formats a diet rule with the display name", () => {
    expect(describeRuleChip({ kind: "diet", target: "vegetarian", severity: "block" }).text).toBe(
      "Vegetarian, blocks"
    );
  });

  it("formats a dislike as an avoidance", () => {
    expect(
      describeRuleChip({ kind: "ingredient", target: "cilantro", severity: "prefer_avoid" }).text
    ).toBe("Avoids cilantro, prefers to avoid");
  });
});

describe("describeRuleSummary", () => {
  it("names the person and shared-facility setting", () => {
    const summary = describeRuleSummary("Parent A", {
      kind: "allergen",
      target: "tree_nut",
      severity: "block",
      sharedFacility: "block",
    });
    expect(summary).toContain("Parent A");
    expect(summary).toContain("Allergic to tree nuts, blocks");
    expect(summary).toContain("Treat shared-facility foods as unsafe");
  });

  it("omits shared-facility copy when ignored", () => {
    const summary = describeRuleSummary("Child B", {
      kind: "allergen",
      target: "peanut",
      severity: "block",
      sharedFacility: "ignore",
    });
    expect(summary).toBe("Child B: Allergic to peanuts, blocks.");
  });
});

describe("removal copy", () => {
  it("names the person and their rules", () => {
    expect(personRemovalCopy("Parent A", 2).body).toContain("2 rules");
    expect(personRemovalCopy("Child B", 1).body).toContain("1 rule");
    expect(personRemovalCopy("Child B", 0).body).not.toContain("rules");
  });

  it("explains what removing a block rule stops doing", () => {
    const copy = ruleRemovalCopy("Parent A", {
      kind: "allergen",
      target: "tree_nut",
      severity: "block",
    });
    expect(copy.body).toContain("Parent A");
    expect(copy.body).toContain("Allergic to tree nuts, blocks");
  });
});

describe("severityPhrase", () => {
  it("covers every stored severity", () => {
    expect(severityPhrase.block).toBe("blocks");
    expect(severityPhrase.warn).toBe("warns");
    expect(severityPhrase.prefer_avoid).toBe("prefers to avoid");
  });
});
