import { describe, it, expect } from "vitest";
import {
  ingredientAllergenMappings,
  buildIngredientMap,
  normalizeIngredientName,
  matchIngredient,
} from "./ingredient-mapping";

describe("ingredientAllergenMappings", () => {
  it("includes peanut with comprehensive aliases", () => {
    const peanut = ingredientAllergenMappings.find((m) => m.name === "peanut");
    expect(peanut).toBeDefined();
    expect(peanut?.allergenCode).toBe("peanut");
    expect(peanut?.aliases).toContain("peanuts");
    expect(peanut?.aliases).toContain("peanut butter");
    expect(peanut?.aliases).toContain("groundnut");
  });

  it("includes all tree nut species", () => {
    const treeNutCodes = [
      "almond",
      "cashew",
      "pecan",
      "walnut",
      "pistachio",
      "hazelnut",
      "macadamia",
      "brazil_nut",
      "pine_nut",
    ];

    for (const code of treeNutCodes) {
      const mapping = ingredientAllergenMappings.find((m) => m.allergenCode === code);
      expect(mapping).toBeDefined();
    }
  });

  it("includes hidden nuts in compound foods", () => {
    const hiddenNutFoods = [
      "pesto",
      "marzipan",
      "satay sauce",
      "baklava",
      "praline",
      "nougat",
      "frangipane",
      "gianduja",
    ];

    for (const food of hiddenNutFoods) {
      const mapping = ingredientAllergenMappings.find((m) => m.name === food);
      expect(mapping).toBeDefined();
    }
  });

  it("includes coconut as separate allergen", () => {
    const coconut = ingredientAllergenMappings.find((m) => m.name === "coconut");
    expect(coconut).toBeDefined();
    expect(coconut?.allergenCode).toBe("coconut");
  });

  it("includes OCR error variants", () => {
    const peanut = ingredientAllergenMappings.find((m) => m.name === "peanut");
    expect(peanut?.aliases).toContain("peanu");
    expect(peanut?.aliases).toContain("penuts");

    const pecan = ingredientAllergenMappings.find((m) => m.name === "pecan");
    expect(pecan?.aliases).toContain("pecons");
  });

  it("includes cross-contact items", () => {
    const chocolateChips = ingredientAllergenMappings.find((m) => m.name === "chocolate chips");
    expect(chocolateChips).toBeDefined();
    expect(chocolateChips?.relation).toBe("commonly_cross_contact");

    const granola = ingredientAllergenMappings.find((m) => m.name === "granola");
    expect(granola).toBeDefined();
    expect(granola?.relation).toBe("commonly_cross_contact");
  });
});

describe("normalizeIngredientName", () => {
  it("converts to lowercase", () => {
    expect(normalizeIngredientName("Peanut Butter")).toBe("peanut butter");
  });

  it("trims whitespace", () => {
    expect(normalizeIngredientName("  almond  ")).toBe("almond");
  });

  it("removes extra spaces", () => {
    expect(normalizeIngredientName("pine   nut")).toBe("pine nut");
  });

  it("removes punctuation", () => {
    expect(normalizeIngredientName("peanut-butter")).toBe("peanut butter");
    expect(normalizeIngredientName("chocolate, chips")).toBe("chocolate chips");
  });

  it("handles combined normalization", () => {
    expect(normalizeIngredientName(" Peanut-Butter! ")).toBe("peanut butter");
  });
});

describe("matchIngredient", () => {
  describe("direct matches", () => {
    it("matches peanut", () => {
      const matches = matchIngredient("peanut");
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0]?.allergenCode).toBe("peanut");
    });

    it("matches almond", () => {
      const matches = matchIngredient("almond");
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0]?.allergenCode).toBe("almond");
    });

    it("matches pine nut", () => {
      const matches = matchIngredient("pine nut");
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0]?.allergenCode).toBe("pine_nut");
    });
  });

  describe("plurals", () => {
    it("matches peanuts", () => {
      const matches = matchIngredient("peanuts");
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0]?.allergenCode).toBe("peanut");
    });

    it("matches almonds", () => {
      const matches = matchIngredient("almonds");
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0]?.allergenCode).toBe("almond");
    });

    it("matches cashews", () => {
      const matches = matchIngredient("cashews");
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0]?.allergenCode).toBe("cashew");
    });
  });

  describe("aliases", () => {
    it("matches groundnut as peanut", () => {
      const matches = matchIngredient("groundnut");
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0]?.allergenCode).toBe("peanut");
    });

    it("matches filbert as hazelnut", () => {
      const matches = matchIngredient("filbert");
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0]?.allergenCode).toBe("hazelnut");
    });

    it("matches pignoli as pine nut", () => {
      const matches = matchIngredient("pignoli");
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0]?.allergenCode).toBe("pine_nut");
    });
  });

  describe("OCR errors", () => {
    it("matches pecons as pecan", () => {
      const matches = matchIngredient("pecons");
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0]?.allergenCode).toBe("pecan");
    });

    it("matches peanu as peanut", () => {
      const matches = matchIngredient("peanu");
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0]?.allergenCode).toBe("peanut");
    });

    it("matches penuts as peanut", () => {
      const matches = matchIngredient("penuts");
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0]?.allergenCode).toBe("peanut");
    });
  });

  describe("hidden nuts in compound foods", () => {
    it("matches pesto to pine nut", () => {
      const matches = matchIngredient("pesto");
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0]?.allergenCode).toBe("pine_nut");
      expect(matches[0]?.relation).toBe("contains");
    });

    it("matches basil pesto to pine nut", () => {
      const matches = matchIngredient("basil pesto");
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0]?.allergenCode).toBe("pine_nut");
    });

    it("matches marzipan to almond", () => {
      const matches = matchIngredient("marzipan");
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0]?.allergenCode).toBe("almond");
      expect(matches[0]?.relation).toBe("contains");
    });

    it("matches satay sauce to peanut", () => {
      const matches = matchIngredient("satay sauce");
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0]?.allergenCode).toBe("peanut");
    });

    it("matches satay to peanut", () => {
      const matches = matchIngredient("satay");
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0]?.allergenCode).toBe("peanut");
    });

    it("matches gado gado to peanut", () => {
      const matches = matchIngredient("gado gado");
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0]?.allergenCode).toBe("peanut");
    });

    it("matches praline to tree nut", () => {
      const matches = matchIngredient("praline");
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0]?.allergenCode).toBe("tree_nut");
    });

    it("matches nougat to tree nut", () => {
      const matches = matchIngredient("nougat");
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0]?.allergenCode).toBe("tree_nut");
    });

    it("matches baklava to tree nut", () => {
      const matches = matchIngredient("baklava");
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0]?.allergenCode).toBe("tree_nut");
    });

    it("matches frangipane to almond", () => {
      const matches = matchIngredient("frangipane");
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0]?.allergenCode).toBe("almond");
    });

    it("matches gianduja to hazelnut", () => {
      const matches = matchIngredient("gianduja");
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0]?.allergenCode).toBe("hazelnut");
    });

    it("matches kung pao to peanut", () => {
      const matches = matchIngredient("kung pao");
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0]?.allergenCode).toBe("peanut");
    });

    it("matches romesco to tree nut", () => {
      const matches = matchIngredient("romesco");
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0]?.allergenCode).toBe("tree_nut");
    });
  });

  describe("may-contain / cross-contact", () => {
    it("matches chocolate chips with cross-contact relation", () => {
      const matches = matchIngredient("chocolate chips");
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0]?.allergenCode).toBe("tree_nut");
      expect(matches[0]?.relation).toBe("commonly_cross_contact");
    });

    it("matches granola with cross-contact relation", () => {
      const matches = matchIngredient("granola");
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0]?.allergenCode).toBe("tree_nut");
      expect(matches[0]?.relation).toBe("commonly_cross_contact");
    });

    it("matches energy bar with cross-contact relation", () => {
      const matches = matchIngredient("energy bar");
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0]?.allergenCode).toBe("tree_nut");
      expect(matches[0]?.relation).toBe("commonly_cross_contact");
    });
  });

  describe("derived products", () => {
    it("matches peanut butter", () => {
      const matches = matchIngredient("peanut butter");
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0]?.allergenCode).toBe("peanut");
    });

    it("matches almond flour", () => {
      const matches = matchIngredient("almond flour");
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0]?.allergenCode).toBe("almond");
    });

    it("matches almond milk", () => {
      const matches = matchIngredient("almond milk");
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0]?.allergenCode).toBe("almond");
    });

    it("matches cashew butter", () => {
      const matches = matchIngredient("cashew butter");
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0]?.allergenCode).toBe("cashew");
    });

    it("matches walnut oil", () => {
      const matches = matchIngredient("walnut oil");
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0]?.allergenCode).toBe("walnut");
    });
  });

  describe("case and punctuation", () => {
    it("matches regardless of case", () => {
      expect(matchIngredient("Peanut")[0]?.allergenCode).toBe("peanut");
      expect(matchIngredient("PEANUT")[0]?.allergenCode).toBe("peanut");
      expect(matchIngredient("PeAnUt")[0]?.allergenCode).toBe("peanut");
    });

    it("matches with punctuation", () => {
      expect(matchIngredient("peanut-butter")[0]?.allergenCode).toBe("peanut");
      expect(matchIngredient("pine nut")[0]?.allergenCode).toBe("pine_nut");
    });

    it("matches with extra whitespace", () => {
      expect(matchIngredient("  peanut  ")[0]?.allergenCode).toBe("peanut");
      expect(matchIngredient("pine   nut")[0]?.allergenCode).toBe("pine_nut");
    });
  });

  describe("non-matches", () => {
    it("returns empty array for unknown ingredients", () => {
      expect(matchIngredient("water")).toEqual([]);
      expect(matchIngredient("sugar")).toEqual([]);
      expect(matchIngredient("salt")).toEqual([]);
    });
  });
});

describe("buildIngredientMap", () => {
  it("creates a map with all ingredients and aliases", () => {
    const map = buildIngredientMap();
    expect(map.size).toBeGreaterThan(50);
  });

  it("includes canonical names", () => {
    const map = buildIngredientMap();
    expect(map.has("peanut")).toBe(true);
    expect(map.has("almond")).toBe(true);
    expect(map.has("cashew")).toBe(true);
  });

  it("includes aliases", () => {
    const map = buildIngredientMap();
    expect(map.has("groundnut")).toBe(true);
    expect(map.has("filbert")).toBe(true);
    expect(map.has("pignoli")).toBe(true);
  });

  it("normalizes all keys", () => {
    const map = buildIngredientMap();
    expect(map.has("pine nut")).toBe(true);
    expect(map.has("peanut butter")).toBe(true);
  });
});
