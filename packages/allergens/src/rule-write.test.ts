import { describe, expect, it } from "vitest";
import {
  buildRuleWrite,
  defaultSeverityForIntent,
  draftFromRule,
  intentToKind,
} from "./rule-write";

describe("intent mapping", () => {
  it("maps guided types onto stored kinds", () => {
    expect(intentToKind("allergy")).toBe("allergen");
    expect(intentToKind("diet")).toBe("diet");
    expect(intentToKind("dislike")).toBe("ingredient");
  });

  it("defaults dislike to prefer-avoid and allergies to block", () => {
    expect(defaultSeverityForIntent("dislike")).toBe("prefer_avoid");
    expect(defaultSeverityForIntent("allergy")).toBe("block");
    expect(defaultSeverityForIntent("diet")).toBe("block");
  });
});

describe("buildRuleWrite", () => {
  it("writes a severe tree-nut allergy with shared-facility block", () => {
    const payload = buildRuleWrite({
      intent: "allergy",
      target: "tree_nut",
      severity: "block",
      sharedFacility: "block",
    });

    expect(payload).toMatchObject({
      kind: "allergen",
      target: "tree_nut",
      severity: "block",
      sharedFacility: "block",
      includeMayContain: true,
      includeCrossContact: true,
      includeDescendants: true,
      treatCoconutAsTreeNut: true,
    });
  });

  it("keeps shared-facility ignore from enabling may-contain flags", () => {
    const payload = buildRuleWrite({
      intent: "allergy",
      target: "peanut",
      severity: "block",
      sharedFacility: "ignore",
    });

    expect(payload.sharedFacility).toBe("ignore");
    expect(payload.includeMayContain).toBe(false);
    expect(payload.includeCrossContact).toBe(false);
  });

  it("enables may-contain flags for shared-facility warn without changing severity", () => {
    const payload = buildRuleWrite({
      intent: "allergy",
      target: "milk",
      severity: "warn",
      sharedFacility: "warn",
    });

    expect(payload.severity).toBe("warn");
    expect(payload.sharedFacility).toBe("warn");
    expect(payload.includeMayContain).toBe(true);
    expect(payload.includeCrossContact).toBe(true);
  });

  it("does not silently change a prefer-avoid dislike into a block", () => {
    const payload = buildRuleWrite({
      intent: "dislike",
      target: "cilantro",
      severity: "prefer_avoid",
      sharedFacility: "ignore",
    });

    expect(payload.kind).toBe("ingredient");
    expect(payload.severity).toBe("prefer_avoid");
    expect(payload.sharedFacility).toBe("ignore");
  });

  it("rejects an empty target", () => {
    expect(() =>
      buildRuleWrite({
        intent: "allergy",
        target: "   ",
        severity: "block",
        sharedFacility: "ignore",
      })
    ).toThrow(/target/i);
  });

  it("preserves an explicit coconut setting on tree nut rules", () => {
    const payload = buildRuleWrite({
      intent: "allergy",
      target: "tree_nut",
      severity: "block",
      sharedFacility: "block",
      treatCoconutAsTreeNut: false,
    });
    expect(payload.treatCoconutAsTreeNut).toBe(false);
  });
});

describe("draftFromRule", () => {
  it("round-trips stored fields without inventing a new severity", () => {
    const draft = draftFromRule({
      kind: "allergen",
      target: "tree_nut",
      severity: "block",
      sharedFacility: "warn",
      treatCoconutAsTreeNut: true,
    });

    expect(draft.intent).toBe("allergy");
    expect(draft.severity).toBe("block");
    expect(draft.sharedFacility).toBe("warn");

    const rewritten = buildRuleWrite(draft);
    expect(rewritten.severity).toBe("block");
    expect(rewritten.sharedFacility).toBe("warn");
    expect(rewritten.includeMayContain).toBe(true);
  });
});
