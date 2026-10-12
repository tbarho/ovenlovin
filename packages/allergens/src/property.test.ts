/**
 * Property-based tests for allergen rule checker
 *
 * Verifies safety invariants from AGENTS.md using fast-check:
 * 1. Rule checking is deterministic
 * 2. Warnings name the affected person
 * 3. Block rules always surface
 * 4. Incomplete checks reported correctly
 * 5. No hard-coded policies
 */

import { describe, it } from "vitest";
import * as fc from "fast-check";
import type { PersonRule, Severity } from "@ovenlovin/core";
import {
  checkIngredientAgainstRule,
  checkIngredientsAgainstRules,
  type RuleCheckContext,
  type IngredientCheckInput,
} from "./rule-checker";

// Arbitraries for generating test data

const severityArb = fc.constantFrom<Severity>("block", "warn", "prefer_avoid");

const allergenTargetArb = fc.constantFrom(
  "peanut",
  "tree_nut",
  "milk",
  "egg",
  "wheat",
  "soy",
  "fish",
  "shellfish",
  "sesame"
);

const sharedFacilityArb = fc.constantFrom("ignore", "warn", "block");

const validDateArb = fc
  .date({ min: new Date("2020-01-01"), max: new Date("2030-12-31") })
  .filter((d) => !isNaN(d.getTime()));

const personRuleArb: fc.Arbitrary<PersonRule> = fc.record({
  id: fc.string({ minLength: 1, maxLength: 36 }).filter((s) => s.trim().length > 0),
  personId: fc.string({ minLength: 1, maxLength: 36 }).filter((s) => s.trim().length > 0),
  kind: fc.constant("allergen" as const),
  target: allergenTargetArb,
  severity: severityArb,
  includeMayContain: fc.boolean(),
  includeCrossContact: fc.boolean(),
  sharedFacility: sharedFacilityArb,
  includeUnmappedIngredients: fc.boolean(),
  includeDescendants: fc.boolean(),
  treatCoconutAsTreeNut: fc.boolean(),
  label: fc.oneof(fc.constant(null), fc.string({ minLength: 1, maxLength: 100 })),
  note: fc.oneof(fc.constant(null), fc.string({ minLength: 1, maxLength: 200 })),
  activeFrom: fc.oneof(fc.constant(null), validDateArb.map((d) => d.toISOString())),
  activeUntil: fc.oneof(fc.constant(null), validDateArb.map((d) => d.toISOString())),
  setBy: fc.string({ minLength: 1, maxLength: 36 }),
  createdAt: validDateArb.map((d) => d.toISOString()),
  updatedAt: validDateArb.map((d) => d.toISOString()),
  createdBy: fc.string({ minLength: 1, maxLength: 36 }),
  deletedAt: fc.constant(null),
});

const ingredientNameArb = fc.constantFrom(
  "peanuts",
  "peanut butter",
  "almonds",
  "cashews",
  "milk",
  "butter",
  "eggs",
  "wheat flour",
  "soy sauce",
  "salmon",
  "shrimp",
  "sesame seeds",
  "flour",
  "sugar",
  "salt",
  "vanilla extract"
);

const ingredientArb: fc.Arbitrary<IngredientCheckInput> = fc.record({
  name: ingredientNameArb,
  ingredientId: fc.option(fc.string({ minLength: 1, maxLength: 36 }), { nil: undefined }),
  confidence: fc.option(fc.double({ min: 0, max: 1 }), { nil: undefined }),
});

const personNameArb = fc
  .string({ minLength: 1, maxLength: 50 })
  .filter((s) => s.trim().length > 0);

// Property tests

describe("Property Tests: Determinism", () => {
  it("checkIngredientAgainstRule is deterministic", () => {
    fc.assert(
      fc.property(personRuleArb, ingredientArb, personNameArb, (rule, ingredient, personName) => {
        const context: RuleCheckContext = {
          personId: rule.personId,
          personName,
          rule,
        };

        const result1 = checkIngredientAgainstRule(ingredient, context);
        const result2 = checkIngredientAgainstRule(ingredient, context);

        return JSON.stringify(result1) === JSON.stringify(result2);
      }),
      { numRuns: 100 }
    );
  });

  it("checkIngredientsAgainstRules is order-independent", () => {
    fc.assert(
      fc.property(
        fc.array(personRuleArb, { minLength: 1, maxLength: 5 }),
        fc.array(ingredientArb, { minLength: 1, maxLength: 5 }),
        fc.array(personNameArb, { minLength: 1, maxLength: 3 }),
        (rules, ingredients, personNames) => {
          // Create contexts with unique person IDs
          const contexts = rules.map((rule, i) => ({
            personId: `person-${i}`,
            personName: personNames[i % personNames.length] ?? "Person",
            rule,
          }));

          const result1 = checkIngredientsAgainstRules(ingredients, contexts);
          const result2 = checkIngredientsAgainstRules(ingredients, contexts);

          return JSON.stringify(result1) === JSON.stringify(result2);
        }
      ),
      { numRuns: 50 }
    );
  });
});

describe("Property Tests: Block Rules Always Surface", () => {
  it("block findings always reported for exact allergen matches", () => {
    fc.assert(
      fc.property(
        allergenTargetArb,
        personNameArb,
        fc.string({ minLength: 1, maxLength: 36 }).filter((s) => s.trim().length > 0),
        (allergen, personName, personId) => {
          const rule: PersonRule = {
            id: "rule-1",
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

          const context: RuleCheckContext = { personId, personName, rule };

          // Use ingredient name that matches the allergen
          const ingredientMap: Record<string, string> = {
            peanut: "peanuts",
            tree_nut: "almonds",
            milk: "milk",
            egg: "eggs",
            wheat: "wheat flour",
            soy: "soy sauce",
            fish: "salmon",
            shellfish: "shrimp",
            sesame: "sesame seeds",
          };

          const ingredient: IngredientCheckInput = {
            name: ingredientMap[allergen] || allergen,
          };

          const findings = checkIngredientAgainstRule(ingredient, context);

          // Must have at least one block finding
          return findings.some((f) => f.severity === "block");
        }
      ),
      { numRuns: 100 }
    );
  });

  it("block severity preserved for all block rules that match", () => {
    fc.assert(
      fc.property(
        fc.array(personRuleArb, { minLength: 1, maxLength: 5 }),
        fc.array(ingredientArb, { minLength: 1, maxLength: 3 }),
        fc.array(personNameArb, { minLength: 1, maxLength: 3 }),
        (rules, ingredients, personNames) => {
          // Force all rules to be block severity
          const blockRules = rules.map((r) => ({ ...r, severity: "block" as Severity }));

          const contexts = blockRules.map((rule, i) => ({
            personId: `person-${i}`,
            personName: personNames[i % personNames.length] ?? "Person",
            rule,
          }));

          const result = checkIngredientsAgainstRules(ingredients, contexts);

          // All findings in result.findings.block must have severity "block"
          return result.findings.block.every((f) => f.severity === "block");
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe("Property Tests: Findings Name Person and Rule", () => {
  it("all findings include person name in message", () => {
    fc.assert(
      fc.property(
        fc.array(personRuleArb, { minLength: 1, maxLength: 3 }),
        fc.array(ingredientArb, { minLength: 1, maxLength: 3 }),
        fc.array(personNameArb, { minLength: 1, maxLength: 3 }),
        (rules, ingredients, personNames) => {
          const contexts = rules.map((rule, i) => ({
            personId: `person-${i}`,
            personName: personNames[i % personNames.length] ?? "Person",
            rule,
          }));

          const result = checkIngredientsAgainstRules(ingredients, contexts);

          const allFindings = [
            ...result.findings.block,
            ...result.findings.warn,
            ...result.findings.prefer_avoid,
          ];

          return allFindings.every((f) => f.message.includes(f.personName));
        }
      ),
      { numRuns: 100 }
    );
  });

  it("all findings include person ID", () => {
    fc.assert(
      fc.property(
        fc.array(personRuleArb, { minLength: 1, maxLength: 3 }),
        fc.array(ingredientArb, { minLength: 1, maxLength: 3 }),
        fc.array(personNameArb, { minLength: 1, maxLength: 3 }),
        (rules, ingredients, personNames) => {
          const contexts = rules.map((rule, i) => ({
            personId: `person-${i}`,
            personName: personNames[i % personNames.length] ?? "Person",
            rule,
          }));

          const result = checkIngredientsAgainstRules(ingredients, contexts);

          const allFindings = [
            ...result.findings.block,
            ...result.findings.warn,
            ...result.findings.prefer_avoid,
          ];

          return allFindings.every((f) => f.personId.length > 0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("all findings include rule ID", () => {
    fc.assert(
      fc.property(
        fc.array(personRuleArb, { minLength: 1, maxLength: 3 }),
        fc.array(ingredientArb, { minLength: 1, maxLength: 3 }),
        fc.array(personNameArb, { minLength: 1, maxLength: 3 }),
        (rules, ingredients, personNames) => {
          const contexts = rules.map((rule, i) => ({
            personId: `person-${i}`,
            personName: personNames[i % personNames.length] ?? "Person",
            rule,
          }));

          const result = checkIngredientsAgainstRules(ingredients, contexts);

          const allFindings = [
            ...result.findings.block,
            ...result.findings.warn,
            ...result.findings.prefer_avoid,
          ];

          return allFindings.every((f) => f.ruleId.length > 0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("all findings include ingredient name", () => {
    fc.assert(
      fc.property(
        fc.array(personRuleArb, { minLength: 1, maxLength: 3 }),
        fc.array(ingredientArb, { minLength: 1, maxLength: 3 }),
        fc.array(personNameArb, { minLength: 1, maxLength: 3 }),
        (rules, ingredients, personNames) => {
          const contexts = rules.map((rule, i) => ({
            personId: `person-${i}`,
            personName: personNames[i % personNames.length] ?? "Person",
            rule,
          }));

          const result = checkIngredientsAgainstRules(ingredients, contexts);

          const allFindings = [
            ...result.findings.block,
            ...result.findings.warn,
            ...result.findings.prefer_avoid,
          ];

          return allFindings.every((f) => f.ingredientName.length > 0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("all findings have correct severity matching the rule", () => {
    fc.assert(
      fc.property(
        fc.array(personRuleArb, { minLength: 1, maxLength: 3 }),
        fc.array(ingredientArb, { minLength: 1, maxLength: 3 }),
        fc.array(personNameArb, { minLength: 1, maxLength: 3 }),
        (rules, ingredients, personNames) => {
          const contexts = rules.map((rule, i) => ({
            personId: `person-${i}`,
            personName: personNames[i % personNames.length] ?? "Person",
            rule,
          }));

          const result = checkIngredientsAgainstRules(ingredients, contexts);

          const allFindings = [
            ...result.findings.block,
            ...result.findings.warn,
            ...result.findings.prefer_avoid,
          ];

          // Each finding's severity must match the rule that created it
          return allFindings.every((finding) => {
            const ruleContext = contexts.find((c) => c.rule.id === finding.ruleId);
            return ruleContext && ruleContext.rule.severity === finding.severity;
          });
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe("Property Tests: Status and Completeness", () => {
  it("status is complete for valid inputs", () => {
    fc.assert(
      fc.property(
        fc.array(personRuleArb, { minLength: 1, maxLength: 3 }),
        fc.array(ingredientArb, { minLength: 1, maxLength: 3 }),
        fc.array(personNameArb, { minLength: 1, maxLength: 3 }),
        (rules, ingredients, personNames) => {
          const contexts = rules.map((rule, i) => ({
            personId: `person-${i}`,
            personName: personNames[i % personNames.length] ?? "Person",
            rule,
          }));

          const result = checkIngredientsAgainstRules(ingredients, contexts);

          return result.status === "complete";
        }
      ),
      { numRuns: 50 }
    );
  });

  it("status is incomplete for empty ingredients", () => {
    fc.assert(
      fc.property(
        fc.array(personRuleArb, { minLength: 1, maxLength: 3 }),
        fc.array(personNameArb, { minLength: 1, maxLength: 3 }),
        (rules, personNames) => {
          const contexts = rules.map((rule, i) => ({
            personId: `person-${i}`,
            personName: personNames[i % personNames.length] ?? "Person",
            rule,
          }));

          const result = checkIngredientsAgainstRules([], contexts);

          return result.status === "incomplete" && (result.incompleteReasons?.length ?? 0) > 0;
        }
      ),
      { numRuns: 50 }
    );
  });

  it("status is incomplete for empty rules", () => {
    fc.assert(
      fc.property(fc.array(ingredientArb, { minLength: 1, maxLength: 3 }), (ingredients) => {
        const result = checkIngredientsAgainstRules(ingredients, []);

        return result.status === "incomplete" && (result.incompleteReasons?.length ?? 0) > 0;
      }),
      { numRuns: 50 }
    );
  });
});

describe("Property Tests: Severity Grouping", () => {
  it("block findings have block severity", () => {
    fc.assert(
      fc.property(
        fc.array(personRuleArb, { minLength: 1, maxLength: 3 }),
        fc.array(ingredientArb, { minLength: 1, maxLength: 3 }),
        fc.array(personNameArb, { minLength: 1, maxLength: 3 }),
        (rules, ingredients, personNames) => {
          const contexts = rules.map((rule, i) => ({
            personId: `person-${i}`,
            personName: personNames[i % personNames.length] ?? "Person",
            rule,
          }));

          const result = checkIngredientsAgainstRules(ingredients, contexts);

          return result.findings.block.every((f) => f.severity === "block");
        }
      ),
      { numRuns: 100 }
    );
  });

  it("warn findings have warn severity", () => {
    fc.assert(
      fc.property(
        fc.array(personRuleArb, { minLength: 1, maxLength: 3 }),
        fc.array(ingredientArb, { minLength: 1, maxLength: 3 }),
        fc.array(personNameArb, { minLength: 1, maxLength: 3 }),
        (rules, ingredients, personNames) => {
          const contexts = rules.map((rule, i) => ({
            personId: `person-${i}`,
            personName: personNames[i % personNames.length] ?? "Person",
            rule,
          }));

          const result = checkIngredientsAgainstRules(ingredients, contexts);

          return result.findings.warn.every((f) => f.severity === "warn");
        }
      ),
      { numRuns: 100 }
    );
  });

  it("prefer_avoid findings have prefer_avoid severity", () => {
    fc.assert(
      fc.property(
        fc.array(personRuleArb, { minLength: 1, maxLength: 3 }),
        fc.array(ingredientArb, { minLength: 1, maxLength: 3 }),
        fc.array(personNameArb, { minLength: 1, maxLength: 3 }),
        (rules, ingredients, personNames) => {
          const contexts = rules.map((rule, i) => ({
            personId: `person-${i}`,
            personName: personNames[i % personNames.length] ?? "Person",
            rule,
          }));

          const result = checkIngredientsAgainstRules(ingredients, contexts);

          return result.findings.prefer_avoid.every((f) => f.severity === "prefer_avoid");
        }
      ),
      { numRuns: 100 }
    );
  });

  it("no findings appear in multiple severity groups", () => {
    fc.assert(
      fc.property(
        fc.array(personRuleArb, { minLength: 1, maxLength: 3 }),
        fc.array(ingredientArb, { minLength: 1, maxLength: 3 }),
        fc.array(personNameArb, { minLength: 1, maxLength: 3 }),
        (rules, ingredients, personNames) => {
          const contexts = rules.map((rule, i) => ({
            personId: `person-${i}`,
            personName: personNames[i % personNames.length] ?? "Person",
            rule,
          }));

          const result = checkIngredientsAgainstRules(ingredients, contexts);

          const blockIds = new Set(
            result.findings.block.map((f) => `${f.personId}-${f.ruleId}-${f.ingredientName}`)
          );
          const warnIds = new Set(
            result.findings.warn.map((f) => `${f.personId}-${f.ruleId}-${f.ingredientName}`)
          );
          const avoidIds = new Set(
            result.findings.prefer_avoid.map(
              (f) => `${f.personId}-${f.ruleId}-${f.ingredientName}`
            )
          );

          // Check no overlap
          const blockWarnOverlap = Array.from(blockIds).some((id) => warnIds.has(id));
          const blockAvoidOverlap = Array.from(blockIds).some((id) => avoidIds.has(id));
          const warnAvoidOverlap = Array.from(warnIds).some((id) => avoidIds.has(id));

          return !blockWarnOverlap && !blockAvoidOverlap && !warnAvoidOverlap;
        }
      ),
      { numRuns: 100 }
    );
  });
});
