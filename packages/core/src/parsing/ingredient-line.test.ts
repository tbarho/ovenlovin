import { describe, expect, it } from "vitest";
import { parseIngredientLine } from "./ingredient-line";

describe("parseIngredientLine", () => {
  it("parses mixed fractions and cups", () => {
    const parsed = parseIngredientLine("2 1/4 cups all-purpose flour");
    expect(parsed.quantityMin).toBe(2.25);
    expect(parsed.quantityMax).toBeNull();
    expect(parsed.unit).toBe("cup");
    expect(parsed.name).toBe("all-purpose flour");
  });

  it("parses unicode fractions", () => {
    const parsed = parseIngredientLine("½ cup olive oil");
    expect(parsed.quantityMin).toBe(0.5);
    expect(parsed.unit).toBe("cup");
    expect(parsed.name).toBe("olive oil");
  });

  it("parses ranges", () => {
    const parsed = parseIngredientLine("1-2 tbsp olive oil");
    expect(parsed.quantityMin).toBe(1);
    expect(parsed.quantityMax).toBe(2);
    expect(parsed.unit).toBe("tbsp");
  });

  it("leaves unquantified lines alone", () => {
    const parsed = parseIngredientLine("salt to taste");
    expect(parsed.quantityMin).toBeNull();
    expect(parsed.unit).toBeNull();
    expect(parsed.name).toBe("salt to taste");
  });

  it("parses count units", () => {
    const parsed = parseIngredientLine("3 cloves garlic, minced");
    expect(parsed.quantityMin).toBe(3);
    expect(parsed.unit).toBe("clove");
    expect(parsed.name).toBe("garlic, minced");
  });
});
