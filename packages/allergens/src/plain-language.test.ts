import { describe, expect, it } from "vitest";
import {
  formatPlainFinding,
  formatUnmappedPlainFinding,
  humanFoodName,
  sanitizeWarningCopy,
} from "./plain-language";

describe("plain-language findings", () => {
  it("lists the offending ingredients next to the allergen", () => {
    expect(
      formatPlainFinding({
        personName: "Parent A",
        severity: "warn",
        allergenCode: "milk",
        ingredientName: "mozzarella, parmesan",
      })
    ).toBe("Contains dairy (mozzarella, parmesan), so check with Parent A first");
  });

  it("names the person and the food, never a severity or allergen code", () => {
    const message = formatPlainFinding({
      personName: "Child B",
      severity: "block",
      allergenCode: "tree_nut",
      allergenName: "pine nuts",
      relation: "contains",
    });
    expect(message).toBe("Contains tree nuts, so Child B can't eat this");
    expect(message).not.toMatch(/block|tree_nut|prefer_avoid/i);
  });

  it("falls back to the human allergen name when the match is only a code", () => {
    expect(
      formatPlainFinding({
        personName: "Child B",
        severity: "block",
        allergenCode: "tree_nut",
        allergenName: "tree_nut",
      })
    ).toBe("Contains tree nuts, so Child B can't eat this");
  });

  it("asks the cook to check first on a warning", () => {
    expect(
      formatPlainFinding({
        personName: "Child B",
        severity: "warn",
        allergenCode: "peanut",
        relation: "commonly_cross_contact",
      })
    ).toBe("May have shared a facility with peanuts, so check with Child B first");
  });

  it("keeps prefer-avoid gentle", () => {
    expect(
      formatPlainFinding({
        personName: "Parent A",
        severity: "prefer_avoid",
        allergenCode: "milk",
      })
    ).toBe("Contains dairy, and Parent A usually skips this");
  });

  it("humanizes codes used as food names", () => {
    expect(humanFoodName("tree_nut")).toBe("tree nuts");
    expect(humanFoodName("pine_nut")).toBe("pine nuts");
  });

  it("explains an unmapped ingredient without codes", () => {
    expect(
      formatUnmappedPlainFinding({
        personName: "Child B",
        ingredientName: "mystery sauce",
      })
    ).toBe('We could not confirm "mystery sauce", so check with Child B before serving');
  });

  it("strips leftover machine codes from a legacy message", () => {
    const cleaned = sanitizeWarningCopy(
      '⛔ Child B (block: tree_nut). "pesto" contains pine nuts.'
    );
    expect(cleaned).not.toMatch(/block\s*:/i);
    expect(cleaned).not.toMatch(/tree_nut/);
    expect(cleaned).toMatch(/Child B/);
    expect(cleaned).toMatch(/pine nuts/i);
  });
});
