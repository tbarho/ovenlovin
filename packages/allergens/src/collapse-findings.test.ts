import { describe, expect, it } from "vitest";
import { collapseRuleFindings, uniqueWarningCopy } from "./collapse-findings";
import type { RuleCheckFinding } from "./rule-checker";

function finding(overrides: Partial<RuleCheckFinding> = {}): RuleCheckFinding {
  return {
    personId: "parent-a",
    personName: "Parent A",
    ruleId: "rule-milk",
    severity: "warn",
    ingredientName: "mozzarella",
    allergenCode: "milk",
    allergenName: "milk",
    relation: "contains",
    message: "Contains dairy, so check with Parent A first",
    confidence: 0.9,
    ...overrides,
  };
}

describe("collapseRuleFindings", () => {
  it("keeps one copy of the same person and allergen, listing every ingredient", () => {
    const collapsed = collapseRuleFindings([
      finding({ ingredientName: "mozzarella" }),
      finding({ ingredientName: "parmesan" }),
    ]);
    expect(collapsed).toHaveLength(1);
    expect(collapsed[0]?.ingredientName).toBe("mozzarella, parmesan");
    expect(collapsed[0]?.message).toMatch(/mozzarella/);
    expect(collapsed[0]?.message).toMatch(/parmesan/);
  });

  it("keeps different people or different messages", () => {
    const collapsed = collapseRuleFindings([
      finding(),
      finding({
        personId: "child-b",
        personName: "Child B",
        message: "Contains dairy, so Child B can't eat this",
        severity: "block",
      }),
    ]);
    expect(collapsed).toHaveLength(2);
  });
});

describe("uniqueWarningCopy", () => {
  it("drops a repeated shopping-list warning", () => {
    expect(
      uniqueWarningCopy([
        { personName: "Child B", message: "Contains tree nuts, so Child B can't eat this" },
        { personName: "Child B", message: "Contains tree nuts, so Child B can't eat this" },
      ])
    ).toHaveLength(1);
  });
});
