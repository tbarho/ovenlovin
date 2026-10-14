import { describe, expect, it } from "vitest";
import type { PersonRule } from "@ovenlovin/core";
import { buildRuleWrite } from "./rule-write";
import { checkIngredientsAgainstRules, type RuleCheckContext } from "./rule-checker";
import {
  defaultBucketForCatalogGroup,
  defaultSharedFacilityPrompt,
  intentAndSeverityForBucket,
  normalizeUiBucket,
  promptFromSharedFacility,
  sharedFacilityFromPrompt,
  showsCoconutToggle,
  showsSharedFacilityPrompt,
  uiBucketForRule,
} from "./rule-ui";

function ruleFromUi(opts: {
  personId?: string;
  target: string;
  group: "allergen" | "diet" | "ingredient";
  bucket: "cant_eat" | "doesnt_like" | "cant_have" | "doesnt_eat" | "rather_not";
  facility?: "yes" | "ask" | "no";
  coconut?: boolean;
}): PersonRule {
  const { intent, severity } = intentAndSeverityForBucket(opts.bucket, opts.group);
  const payload = buildRuleWrite({
    intent,
    target: opts.target,
    severity,
    sharedFacility: sharedFacilityFromPrompt(opts.facility ?? "no"),
    treatCoconutAsTreeNut: opts.coconut,
  });
  const now = "2026-01-01T00:00:00.000Z";
  return {
    id: "rule-ui-1",
    personId: opts.personId ?? "child-b",
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    createdBy: "admin-1",
    setBy: "admin-1",
    activeFrom: null,
    activeUntil: null,
    includeUnmappedIngredients: false,
    ...payload,
  };
}

function contextFor(rule: PersonRule, name = "Child B"): RuleCheckContext {
  return { personId: rule.personId, personName: name, rule };
}

describe("rule UI mapping", () => {
  it("defaults catalog groups to Can't eat / Doesn't like", () => {
    expect(defaultBucketForCatalogGroup("allergen")).toBe("cant_eat");
    expect(defaultBucketForCatalogGroup("diet")).toBe("cant_eat");
    expect(defaultBucketForCatalogGroup("ingredient")).toBe("doesnt_like");
  });

  it("maps Can't eat / Doesn't like onto stored severity and kind", () => {
    const allergy = intentAndSeverityForBucket("cant_eat", "allergen");
    expect(allergy).toEqual({ intent: "allergy", severity: "block" });

    const diet = intentAndSeverityForBucket("cant_eat", "diet");
    expect(diet).toEqual({ intent: "diet", severity: "block" });

    const prefer = intentAndSeverityForBucket("doesnt_like", "ingredient");
    expect(prefer).toEqual({ intent: "dislike", severity: "prefer_avoid" });
  });

  it("migrates the retired Doesn't eat bucket onto Can't eat (block, kind diet)", () => {
    expect(normalizeUiBucket("doesnt_eat")).toBe("cant_eat");
    expect(normalizeUiBucket("cant_have")).toBe("cant_eat");
    expect(normalizeUiBucket("rather_not")).toBe("doesnt_like");
    const diet = intentAndSeverityForBucket("doesnt_eat", "diet");
    expect(diet).toEqual({ intent: "diet", severity: "block" });
  });

  it("never stores a nut allergen as kind diet (checker only matches allergen rules)", () => {
    const fields = intentAndSeverityForBucket("cant_eat", "allergen");
    expect(fields.intent).toBe("allergy");
    expect(fields.severity).toBe("block");
    expect(buildRuleWrite({ ...fields, target: "tree_nut", sharedFacility: "warn" }).kind).toBe(
      "allergen"
    );
  });

  it("maps Yes / Ask me / No onto sharedFacility block / warn / ignore", () => {
    expect(sharedFacilityFromPrompt("yes")).toBe("block");
    expect(sharedFacilityFromPrompt("ask")).toBe("warn");
    expect(sharedFacilityFromPrompt("no")).toBe("ignore");
    expect(promptFromSharedFacility("block")).toBe("yes");
    expect(promptFromSharedFacility("warn")).toBe("ask");
    expect(promptFromSharedFacility("ignore")).toBe("no");
  });

  it("shows coconut only on tree nuts and facility prompt on peanut and tree nut", () => {
    expect(showsCoconutToggle("tree_nut")).toBe(true);
    expect(showsCoconutToggle("peanut")).toBe(false);
    expect(showsSharedFacilityPrompt("tree_nut")).toBe(true);
    expect(showsSharedFacilityPrompt("peanut")).toBe(true);
    expect(showsSharedFacilityPrompt("milk")).toBe(false);
    expect(defaultSharedFacilityPrompt("tree_nut")).toBe("ask");
    expect(defaultSharedFacilityPrompt("milk")).toBe("no");
  });

  it("groups stored rules into the two UI buckets, including legacy diet blocks", () => {
    expect(uiBucketForRule({ kind: "allergen", severity: "block" })).toBe("cant_eat");
    expect(uiBucketForRule({ kind: "diet", severity: "block" })).toBe("cant_eat");
    expect(uiBucketForRule({ kind: "ingredient", severity: "prefer_avoid" })).toBe("doesnt_like");
    expect(uiBucketForRule({ kind: "allergen", severity: "prefer_avoid" })).toBe("doesnt_like");
  });
});

describe("UI write → checker (severe nut allergy)", () => {
  it("blocks pesto pine nuts for a Can't eat tree-nut rule", () => {
    const rule = ruleFromUi({
      target: "tree_nut",
      group: "allergen",
      bucket: "cant_eat",
      facility: "ask",
      coconut: false,
    });
    expect(rule.kind).toBe("allergen");
    expect(rule.severity).toBe("block");
    expect(rule.sharedFacility).toBe("warn");
    expect(rule.includeCrossContact).toBe(true);
    expect(rule.treatCoconutAsTreeNut).toBe(false);

    const result = checkIngredientsAgainstRules(
      [{ name: "pesto" }, { name: "basil" }],
      [contextFor(rule)]
    );
    expect(result.status).toBe("complete");
    expect(result.findings.block).toHaveLength(1);
    expect(result.findings.block[0]?.personName).toBe("Child B");
    expect(result.findings.block[0]?.allergenCode).toBe("pine_nut");
    expect(result.findings.warn).toHaveLength(0);
  });

  it("blocks peanuts for Can't eat peanut + Yes (shared facility block)", () => {
    const rule = ruleFromUi({
      target: "peanut",
      group: "allergen",
      bucket: "cant_eat",
      facility: "yes",
    });
    expect(rule.sharedFacility).toBe("block");
    expect(rule.includeMayContain).toBe(true);
    expect(rule.includeCrossContact).toBe(true);

    const result = checkIngredientsAgainstRules([{ name: "peanuts" }], [contextFor(rule)]);
    expect(result.findings.block[0]?.severity).toBe("block");
    expect(result.findings.block[0]?.allergenCode).toBe("peanut");
  });

  it("warns on chocolate chips when Ask me enables tree-nut cross-contact, and ignores them when No", () => {
    const ask = ruleFromUi({
      target: "tree_nut",
      group: "allergen",
      bucket: "cant_eat",
      facility: "ask",
    });
    const ignore = ruleFromUi({
      target: "tree_nut",
      group: "allergen",
      bucket: "cant_eat",
      facility: "no",
    });
    expect(ask.sharedFacility).toBe("warn");
    expect(ask.includeCrossContact).toBe(true);
    expect(ignore.sharedFacility).toBe("ignore");
    expect(ignore.includeCrossContact).toBe(false);

    const asked = checkIngredientsAgainstRules([{ name: "chocolate chips" }], [contextFor(ask)]);
    const ignored = checkIngredientsAgainstRules(
      [{ name: "chocolate chips" }],
      [contextFor(ignore)]
    );

    // Ask me persists sharedFacility=warn and turns cross-contact on. Finding
    // severity still comes from the rule (Can't eat → block), not the prompt.
    const askedHits = [...asked.findings.block, ...asked.findings.warn];
    expect(askedHits).toHaveLength(1);
    expect(askedHits[0]?.personName).toBe("Child B");
    expect(askedHits[0]?.allergenCode).toBe("tree_nut");
    expect(askedHits[0]?.relation).toBe("commonly_cross_contact");
    expect(askedHits[0]?.severity).toBe("block");
    expect(ignored.findings.block).toHaveLength(0);
    expect(ignored.findings.warn).toHaveLength(0);
  });

  it("treats coconut as a tree nut only when the toggle is on", () => {
    const on = ruleFromUi({
      target: "tree_nut",
      group: "allergen",
      bucket: "cant_eat",
      coconut: true,
    });
    const off = ruleFromUi({
      target: "tree_nut",
      group: "allergen",
      bucket: "cant_eat",
      coconut: false,
    });

    const withCoconut = checkIngredientsAgainstRules([{ name: "coconut milk" }], [contextFor(on)]);
    const without = checkIngredientsAgainstRules([{ name: "coconut milk" }], [contextFor(off)]);

    expect(on.treatCoconutAsTreeNut).toBe(true);
    expect(off.treatCoconutAsTreeNut).toBe(false);
    expect(withCoconut.findings.block[0]?.allergenCode).toBe("coconut");
    expect(without.findings.block).toHaveLength(0);
  });

  it("keeps Doesn't like as prefer_avoid, never a silent block", () => {
    const rule = ruleFromUi({
      target: "mushroom",
      group: "ingredient",
      bucket: "doesnt_like",
    });
    expect(rule.kind).toBe("ingredient");
    expect(rule.severity).toBe("prefer_avoid");
    expect(uiBucketForRule(rule)).toBe("doesnt_like");
  });

  it("matches a custom Can't eat term against an ingredient line", () => {
    const rule = ruleFromUi({
      target: "durian",
      group: "ingredient",
      bucket: "cant_eat",
    });
    expect(rule.kind).toBe("ingredient");
    expect(rule.severity).toBe("block");
    const result = checkIngredientsAgainstRules(
      [{ name: "1 cup durian puree" }],
      [contextFor(rule)]
    );
    expect(result.findings.block[0]?.personName).toBe("Child B");
    expect(result.findings.block[0]?.ingredientName).toBe("1 cup durian puree");
  });
});
