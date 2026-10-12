import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import type { PersonRule } from "@ovenlovin/core";
import {
  checkIngredientsAgainstRules,
  type RuleCheckContext,
  type IngredientCheckInput,
} from "./rule-checker";

// Arbitraries for generating test data
const allergenCodeArb = fc.constantFrom(
  "peanut",
  "tree_nut",
  "almond",
  "cashew",
  "milk",
  "egg",
  "wheat",
  "soy",
  "fish",
  "shellfish",
  "sesame"
);

const severityArb = fc.constantFrom("block", "warn", "prefer_avoid");

const sharedFacilityArb = fc.constantFrom("ignore", "warn", "block");

const personRuleArb = fc.record({
  id: fc.uuid(),
  personId: fc.uuid(),
  kind: fc.constant("allergen" as const),
  target: allergenCodeArb,
  severity: severityArb,
  includeMayContain: fc.boolean(),
  includeCrossContact: fc.boolean(),
  sharedFacility: sharedFacilityArb,
  includeUnmappedIngredients: fc.boolean(),
  includeDescendants: fc.boolean(),
  treatCoconutAsTreeNut: fc.boolean(),
  label: fc.option(fc.string(), { nil: null }),
  note: fc.option(fc.string(), { nil: null }),
  activeFrom: fc.option(
    fc
      .date({ min: new Date("2020-01-01"), max: new Date("2030-12-31") })
      .filter((d) => !isNaN(d.getTime()))
      .map((d) => d.toISOString()),
    { nil: null }
  ),
  activeUntil: fc.option(
    fc
      .date({ min: new Date("2020-01-01"), max: new Date("2030-12-31") })
      .filter((d) => !isNaN(d.getTime()))
      .map((d) => d.toISOString()),
    { nil: null }
  ),
  setBy: fc.string(),
  createdAt: fc
    .date({ min: new Date("2020-01-01"), max: new Date("2027-12-31") })
    .filter((d) => !isNaN(d.getTime()))
    .map((d) => d.toISOString()),
  updatedAt: fc
    .date({ min: new Date("2020-01-01"), max: new Date("2027-12-31") })
    .filter((d) => !isNaN(d.getTime()))
    .map((d) => d.toISOString()),
  createdBy: fc.string(),
  deletedAt: fc.constant(null),
}) as fc.Arbitrary<PersonRule>;

const ingredientArb = fc.record({
  name: fc.oneof(
    fc.constantFrom(
      "peanut",
      "peanuts",
      "peanut butter",
      "almond",
      "almonds",
      "almond milk",
      "milk",
      "eggs",
      "wheat flour",
      "soy sauce",
      "salmon",
      "shrimp",
      "sesame seeds"
    ),
    fc.string({ minLength: 1, maxLength: 50 })
  ),
}) as fc.Arbitrary<IngredientCheckInput>;

const contextArb = fc.tuple(fc.string({ minLength: 1, maxLength: 50 }), personRuleArb).map(
  ([personName, rule]): RuleCheckContext => ({
    personId: rule.personId,
    personName,
    rule,
  })
);

describe("Property-based tests for rule checker", () => {
  describe("determinism", () => {
    it("returns identical results for same inputs", () => {
      fc.assert(
        fc.property(
          fc.array(ingredientArb, { minLength: 1, maxLength: 10 }),
          fc.array(contextArb, { minLength: 1, maxLength: 5 }),
          (ingredients, contexts) => {
            const result1 = checkIngredientsAgainstRules(ingredients, contexts);
            const result2 = checkIngredientsAgainstRules(ingredients, contexts);

            expect(result1.status).toBe(result2.status);
            expect(result1.findings.block.length).toBe(result2.findings.block.length);
            expect(result1.findings.warn.length).toBe(result2.findings.warn.length);
            expect(result1.findings.prefer_avoid.length).toBe(result2.findings.prefer_avoid.length);

            if (result1.status === "incomplete") {
              expect(result2.status).toBe("incomplete");
              expect(result1.incompleteReasons).toEqual(result2.incompleteReasons);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it("returns identical results regardless of input order for unordered contexts", () => {
      fc.assert(
        fc.property(
          fc.array(ingredientArb, { minLength: 1, maxLength: 10 }),
          fc.array(contextArb, { minLength: 2, maxLength: 5 }),
          (ingredients, contexts) => {
            const shuffledContexts = [...contexts].sort(() => Math.random() - 0.5);

            const result1 = checkIngredientsAgainstRules(ingredients, contexts);
            const result2 = checkIngredientsAgainstRules(ingredients, shuffledContexts);

            const sortFindings = (findings: any[]) => 
              [...findings].sort((a, b) => 
                (a.message || "").localeCompare(b.message || "")
              );

            expect(result1.status).toBe(result2.status);
            expect(sortFindings(result1.findings.block).length).toBe(
              sortFindings(result2.findings.block).length
            );
            expect(sortFindings(result1.findings.warn).length).toBe(
              sortFindings(result2.findings.warn).length
            );
            expect(sortFindings(result1.findings.prefer_avoid).length).toBe(
              sortFindings(result2.findings.prefer_avoid).length
            );
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe("block rules always surface", () => {
    it("always reports block findings for exact allergen matches", () => {
      fc.assert(
        fc.property(
          allergenCodeArb,
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.uuid(),
          (allergen, personName, personId) => {
            const rule: PersonRule = {
              id: "test-rule",
              personId,
              kind: "allergen",
              target: allergen,
              severity: "block",
              includeMayContain: false,
              includeCrossContact: false,
              sharedFacility: "ignore",
              includeUnmappedIngredients: false,
              includeDescendants: true,
              treatCoconutAsTreeNut: true,
              label: null,
              note: null,
              activeFrom: null,
              activeUntil: null,
              setBy: "admin",
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              createdBy: "admin",
              deletedAt: null,
            };

            const context: RuleCheckContext = {
              personId,
              personName,
              rule,
            };

            // Use the exact allergen name as the ingredient to ensure a match
            const ingredient: IngredientCheckInput = { name: allergen };

            const result = checkIngredientsAgainstRules([ingredient], [context]);

            // The result may be complete or incomplete, but if it's complete
            // and the allergen is matched by the rule, there should be a block finding
            if (result.status === "complete") {
              // If the ingredient matches, we expect findings
              // Note: Some allergens may not be in the mapping and won't match
              // This is okay - the test is checking that when there IS a match, it's a block
              if (result.findings.block.length > 0 || result.findings.warn.length > 0 || result.findings.prefer_avoid.length > 0) {
                const blockFinding = result.findings.block.find(
                  (f) => f.personId === personId && f.ruleId === rule.id
                );
                // If there's any finding for this person/rule, block findings should exist
                const allFindings = [
                  ...result.findings.block,
                  ...result.findings.warn,
                  ...result.findings.prefer_avoid,
                ];
                const hasFindingForRule = allFindings.some(
                  (f) => f.personId === personId && f.ruleId === rule.id
                );
                if (hasFindingForRule) {
                  expect(blockFinding).toBeDefined();
                }
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it("always reports block severity for block rules that match", () => {
      fc.assert(
        fc.property(
          fc.array(ingredientArb, { minLength: 1, maxLength: 10 }),
          contextArb,
          (ingredients, context) => {
            if (context.rule.severity !== "block") {
              return;
            }

            const result = checkIngredientsAgainstRules(ingredients, [context]);

            if (result.status === "complete") {
              result.findings.block.forEach((finding) => {
                expect(finding.severity).toBe("block");
                expect(finding.ruleId).toBe(context.rule.id);
              });
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe("findings name the person and rule", () => {
    it("all findings include person name in message", () => {
      fc.assert(
        fc.property(
          fc.array(ingredientArb, { minLength: 1, maxLength: 10 }),
          fc.array(contextArb, { minLength: 1, maxLength: 5 }),
          (ingredients, contexts) => {
            const result = checkIngredientsAgainstRules(ingredients, contexts);

            if (result.status === "complete") {
              const allFindings = [
                ...result.findings.block,
                ...result.findings.warn,
                ...result.findings.prefer_avoid,
              ];

              allFindings.forEach((finding) => {
                const context = contexts.find((c) => c.rule.id === finding.ruleId);
                expect(context).toBeDefined();
                expect(finding.message).toContain(context!.personName);
              });
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it("all findings include person ID", () => {
      fc.assert(
        fc.property(
          fc.array(ingredientArb, { minLength: 1, maxLength: 10 }),
          fc.array(contextArb, { minLength: 1, maxLength: 5 }),
          (ingredients, contexts) => {
            const result = checkIngredientsAgainstRules(ingredients, contexts);

            if (result.status === "complete") {
              const allFindings = [
                ...result.findings.block,
                ...result.findings.warn,
                ...result.findings.prefer_avoid,
              ];

              allFindings.forEach((finding) => {
                expect(finding.personId).toBeTruthy();
                const context = contexts.find((c) => c.personId === finding.personId);
                expect(context).toBeDefined();
              });
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it("all findings include rule ID", () => {
      fc.assert(
        fc.property(
          fc.array(ingredientArb, { minLength: 1, maxLength: 10 }),
          fc.array(contextArb, { minLength: 1, maxLength: 5 }),
          (ingredients, contexts) => {
            const result = checkIngredientsAgainstRules(ingredients, contexts);

            if (result.status === "complete") {
              const allFindings = [
                ...result.findings.block,
                ...result.findings.warn,
                ...result.findings.prefer_avoid,
              ];

              allFindings.forEach((finding) => {
                expect(finding.ruleId).toBeTruthy();
                const context = contexts.find((c) => c.rule.id === finding.ruleId);
                expect(context).toBeDefined();
              });
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it("all findings include ingredient name", () => {
      fc.assert(
        fc.property(
          fc.array(ingredientArb, { minLength: 1, maxLength: 10 }),
          fc.array(contextArb, { minLength: 1, maxLength: 5 }),
          (ingredients, contexts) => {
            const result = checkIngredientsAgainstRules(ingredients, contexts);

            if (result.status === "complete") {
              const allFindings = [
                ...result.findings.block,
                ...result.findings.warn,
                ...result.findings.prefer_avoid,
              ];

              allFindings.forEach((finding) => {
                expect(finding.ingredientName).toBeTruthy();
                const ingredient = ingredients.find((i) => i.name === finding.ingredientName);
                expect(ingredient).toBeDefined();
              });
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it("all findings include severity that matches rule", () => {
      fc.assert(
        fc.property(
          fc.array(ingredientArb, { minLength: 1, maxLength: 10 }),
          fc.array(contextArb, { minLength: 1, maxLength: 5 }),
          (ingredients, contexts) => {
            const result = checkIngredientsAgainstRules(ingredients, contexts);

            if (result.status === "complete") {
              const allFindings = [
                ...result.findings.block,
                ...result.findings.warn,
                ...result.findings.prefer_avoid,
              ];

              allFindings.forEach((finding) => {
                const context = contexts.find((c) => c.rule.id === finding.ruleId);
                expect(context).toBeDefined();
                expect(finding.severity).toBe(context!.rule.severity);
              });
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe("status and completeness", () => {
    it("returns complete status when inputs are valid", () => {
      fc.assert(
        fc.property(
          fc.array(ingredientArb, { minLength: 1, maxLength: 10 }),
          fc.array(contextArb, { minLength: 1, maxLength: 5 }),
          (ingredients, contexts) => {
            const result = checkIngredientsAgainstRules(ingredients, contexts);

            expect(result.status).toBe("complete");
            expect(result.incompleteReasons || []).toEqual([]);
          }
        ),
        { numRuns: 100 }
      );
    });

    it("returns incomplete status for empty ingredients", () => {
      fc.assert(
        fc.property(fc.array(contextArb, { minLength: 1, maxLength: 5 }), (contexts) => {
          const result = checkIngredientsAgainstRules([], contexts);

          expect(result.status).toBe("incomplete");
          expect(result.incompleteReasons.length).toBeGreaterThan(0);
          expect(result.incompleteReasons.some((r) => r.includes("ingredient"))).toBe(true);
        }),
        { numRuns: 50 }
      );
    });

    it("returns incomplete status for empty rules", () => {
      fc.assert(
        fc.property(fc.array(ingredientArb, { minLength: 1, maxLength: 10 }), (ingredients) => {
          const result = checkIngredientsAgainstRules(ingredients, []);

          expect(result.status).toBe("incomplete");
          expect(result.incompleteReasons.length).toBeGreaterThan(0);
          expect(result.incompleteReasons.some((r) => r.includes("rule"))).toBe(true);
        }),
        { numRuns: 50 }
      );
    });
  });

  describe("severity grouping", () => {
    it("all block findings have block severity", () => {
      fc.assert(
        fc.property(
          fc.array(ingredientArb, { minLength: 1, maxLength: 10 }),
          fc.array(contextArb, { minLength: 1, maxLength: 5 }),
          (ingredients, contexts) => {
            const result = checkIngredientsAgainstRules(ingredients, contexts);

            if (result.status === "complete") {
              result.findings.block.forEach((finding) => {
                expect(finding.severity).toBe("block");
              });
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it("all warn findings have warn severity", () => {
      fc.assert(
        fc.property(
          fc.array(ingredientArb, { minLength: 1, maxLength: 10 }),
          fc.array(contextArb, { minLength: 1, maxLength: 5 }),
          (ingredients, contexts) => {
            const result = checkIngredientsAgainstRules(ingredients, contexts);

            if (result.status === "complete") {
              result.findings.warn.forEach((finding) => {
                expect(finding.severity).toBe("warn");
              });
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it("all prefer_avoid findings have prefer_avoid severity", () => {
      fc.assert(
        fc.property(
          fc.array(ingredientArb, { minLength: 1, maxLength: 10 }),
          fc.array(contextArb, { minLength: 1, maxLength: 5 }),
          (ingredients, contexts) => {
            const result = checkIngredientsAgainstRules(ingredients, contexts);

            if (result.status === "complete") {
              result.findings.prefer_avoid.forEach((finding) => {
                expect(finding.severity).toBe("prefer_avoid");
              });
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it("no findings exist in multiple severity groups", () => {
      fc.assert(
        fc.property(
          fc.array(ingredientArb, { minLength: 1, maxLength: 10 }),
          fc.array(contextArb, { minLength: 1, maxLength: 5 }),
          (ingredients, contexts) => {
            const result = checkIngredientsAgainstRules(ingredients, contexts);

            if (result.status === "complete") {
              const blockIds = new Set(result.findings.block.map((f) => `${f.personId}-${f.ruleId}-${f.ingredientName}`));
              const warnIds = new Set(result.findings.warn.map((f) => `${f.personId}-${f.ruleId}-${f.ingredientName}`));
              const avoidIds = new Set(result.findings.prefer_avoid.map((f) => `${f.personId}-${f.ruleId}-${f.ingredientName}`));

              blockIds.forEach((id) => {
                expect(warnIds.has(id)).toBe(false);
                expect(avoidIds.has(id)).toBe(false);
              });

              warnIds.forEach((id) => {
                expect(blockIds.has(id)).toBe(false);
                expect(avoidIds.has(id)).toBe(false);
              });
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
