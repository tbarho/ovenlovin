import { describe, expect, it } from "vitest";
import { attendeeWarningsFromCheck, isBlockedForAttendees } from "./attendee-filter";
import type { RuleCheckResult } from "./rule-checker";

function emptyResult(overrides: Partial<RuleCheckResult> = {}): RuleCheckResult {
  return {
    status: "complete",
    findings: { block: [], warn: [], prefer_avoid: [] },
    ...overrides,
  };
}

describe("isBlockedForAttendees", () => {
  it("is true only when a block finding exists", () => {
    expect(isBlockedForAttendees(emptyResult())).toBe(false);
    expect(
      isBlockedForAttendees(
        emptyResult({
          findings: {
            block: [
              {
                personId: "p1",
                personName: "Child A",
                ruleId: "r1",
                severity: "block",
                ingredientName: "peanuts",
                allergenCode: "peanut",
                allergenName: "Peanut",
                relation: "contains",
                message: "Child A cannot eat peanuts",
                confidence: 0.9,
              },
            ],
            warn: [],
            prefer_avoid: [],
          },
        })
      )
    ).toBe(true);
  });

  it("flattens warn findings without treating them as blocks", () => {
    const result = emptyResult({
      findings: {
        block: [],
        warn: [
          {
            personId: "p2",
            personName: "Parent A",
            ruleId: "r2",
            severity: "warn",
            ingredientName: "butter",
            allergenCode: "milk",
            allergenName: "Milk",
            relation: "contains",
            message: "Parent A warn milk",
            confidence: 0.9,
          },
        ],
        prefer_avoid: [],
      },
    });
    expect(isBlockedForAttendees(result)).toBe(false);
    expect(attendeeWarningsFromCheck(result)).toEqual([
      { personId: "p2", severity: "warn", message: "Parent A warn milk" },
    ]);
  });
});
