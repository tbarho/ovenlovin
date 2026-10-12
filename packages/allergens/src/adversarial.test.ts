import { describe, it, expect } from "vitest";
import { matchIngredient } from "./ingredient-mapping";

/**
 * Additional adversarial tests for allergen detection
 * These tests cover edge cases, foreign terms, nested preparations,
 * and additional OCR errors that might appear in real-world recipes.
 */

describe("adversarial allergen detection", () => {
  describe("foreign language terms", () => {
    it("matches French terms", () => {
      const matches = matchIngredient("noix");
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0]?.allergenCode).toBe("walnut");
    });

    it("matches Spanish terms", () => {
      const maní = matchIngredient("maní");
      expect(maní.length).toBeGreaterThan(0);
      expect(maní[0]?.allergenCode).toBe("peanut");

      const cacahuete = matchIngredient("cacahuete");
      expect(cacahuete.length).toBeGreaterThan(0);
      expect(cacahuete[0]?.allergenCode).toBe("peanut");
    });

    it("matches Italian terms", () => {
      const nocciola = matchIngredient("nocciola");
      expect(nocciola.length).toBeGreaterThan(0);
      expect(nocciola[0]?.allergenCode).toBe("hazelnut");

      const mandorla = matchIngredient("mandorla");
      expect(mandorla.length).toBeGreaterThan(0);
      expect(mandorla[0]?.allergenCode).toBe("almond");
    });

    it("matches German terms", () => {
      const erdnuss = matchIngredient("erdnuss");
      expect(erdnuss.length).toBeGreaterThan(0);
      expect(erdnuss[0]?.allergenCode).toBe("peanut");

      const haselnuss = matchIngredient("haselnuss");
      expect(haselnuss.length).toBeGreaterThan(0);
      expect(haselnuss[0]?.allergenCode).toBe("hazelnut");
    });
  });

  describe("nested and compound preparations", () => {
    it("matches pesto pasta", () => {
      const matches = matchIngredient("pesto pasta");
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0]?.allergenCode).toBe("pine_nut");
    });

    it("matches peanut sauce noodles", () => {
      const matches = matchIngredient("peanut sauce noodles");
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0]?.allergenCode).toBe("peanut");
    });

    it("matches almond croissant", () => {
      const matches = matchIngredient("almond croissant");
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0]?.allergenCode).toBe("almond");
    });

    it("matches walnut bread", () => {
      const matches = matchIngredient("walnut bread");
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0]?.allergenCode).toBe("walnut");
    });

    it("matches pecan pie filling", () => {
      const matches = matchIngredient("pecan pie filling");
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0]?.allergenCode).toBe("pecan");
    });
  });

  describe("additional OCR errors and typos", () => {
    it("matches alm0nd (zero instead of o)", () => {
      const matches = matchIngredient("alm0nd");
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0]?.allergenCode).toBe("almond");
    });

    it("matches cashw (truncated)", () => {
      const matches = matchIngredient("cashw");
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0]?.allergenCode).toBe("cashew");
    });

    it("matches walmt (n as m)", () => {
      const matches = matchIngredient("walmt");
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0]?.allergenCode).toBe("walnut");
    });

    it("matches pist achio (space inserted)", () => {
      const matches = matchIngredient("pist achio");
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0]?.allergenCode).toBe("pistachio");
    });

    it("matches hazelunt (typo)", () => {
      const matches = matchIngredient("hazelunt");
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0]?.allergenCode).toBe("hazelnut");
    });

    it("matches macadmia (typo)", () => {
      const matches = matchIngredient("macadmia");
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0]?.allergenCode).toBe("macadamia");
    });
  });

  describe("processed and prepared forms", () => {
    it("matches roasted peanuts", () => {
      const matches = matchIngredient("roasted peanuts");
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0]?.allergenCode).toBe("peanut");
    });

    it("matches toasted almonds", () => {
      const matches = matchIngredient("toasted almonds");
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0]?.allergenCode).toBe("almond");
    });

    it("matches salted cashews", () => {
      const matches = matchIngredient("salted cashews");
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0]?.allergenCode).toBe("cashew");
    });

    it("matches candied pecans", () => {
      const matches = matchIngredient("candied pecans");
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0]?.allergenCode).toBe("pecan");
    });

    it("matches chopped walnuts", () => {
      const matches = matchIngredient("chopped walnuts");
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0]?.allergenCode).toBe("walnut");
    });

    it("matches sliced almonds", () => {
      const matches = matchIngredient("sliced almonds");
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0]?.allergenCode).toBe("almond");
    });

    it("matches ground hazelnuts", () => {
      const matches = matchIngredient("ground hazelnuts");
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0]?.allergenCode).toBe("hazelnut");
    });
  });

  describe("additional hidden allergen sources", () => {
    it("matches pad thai (often contains peanuts)", () => {
      const matches = matchIngredient("pad thai");
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0]?.allergenCode).toBe("peanut");
    });

    it("matches dukkah (contains nuts)", () => {
      const matches = matchIngredient("dukkah");
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0]?.allergenCode).toBe("tree_nut");
    });

    it("matches amaretti (contains almonds)", () => {
      const matches = matchIngredient("amaretti");
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0]?.allergenCode).toBe("almond");
    });

    it("matches macarons (contain almonds)", () => {
      const matches = matchIngredient("macarons");
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0]?.allergenCode).toBe("almond");
    });

    it("matches nut brittle", () => {
      const matches = matchIngredient("nut brittle");
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0]?.allergenCode).toBe("tree_nut");
    });

    it("matches peanut brittle", () => {
      const matches = matchIngredient("peanut brittle");
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0]?.allergenCode).toBe("peanut");
    });

    it("matches nut bar", () => {
      const matches = matchIngredient("nut bar");
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0]?.allergenCode).toBe("tree_nut");
    });
  });

  describe("may-contain scenarios", () => {
    it("detects cross-contact in baked goods", () => {
      const brownies = matchIngredient("brownies");
      expect(brownies.length).toBeGreaterThan(0);
      expect(brownies[0]?.relation).toBe("commonly_cross_contact");

      const cookies = matchIngredient("cookies");
      expect(cookies.length).toBeGreaterThan(0);
      expect(cookies[0]?.relation).toBe("commonly_cross_contact");
    });

    it("detects cross-contact in breakfast foods", () => {
      const cereal = matchIngredient("cereal");
      expect(cereal.length).toBeGreaterThan(0);
      expect(cereal[0]?.relation).toBe("commonly_cross_contact");

      const muesli = matchIngredient("muesli");
      expect(muesli.length).toBeGreaterThan(0);
      expect(muesli[0]?.relation).toBe("commonly_cross_contact");
    });

    it("detects cross-contact in snack mixes", () => {
      const trailMix = matchIngredient("trail mix");
      expect(trailMix.length).toBeGreaterThan(0);
      expect(trailMix[0]?.relation).toBe("commonly_cross_contact");

      const snackMix = matchIngredient("snack mix");
      expect(snackMix.length).toBeGreaterThan(0);
      expect(snackMix[0]?.relation).toBe("commonly_cross_contact");
    });
  });

  describe("coconut edge cases", () => {
    it("matches coconut milk", () => {
      const matches = matchIngredient("coconut milk");
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0]?.allergenCode).toBe("coconut");
    });

    it("matches coconut oil", () => {
      const matches = matchIngredient("coconut oil");
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0]?.allergenCode).toBe("coconut");
    });

    it("matches coconut flour", () => {
      const matches = matchIngredient("coconut flour");
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0]?.allergenCode).toBe("coconut");
    });

    it("matches shredded coconut", () => {
      const matches = matchIngredient("shredded coconut");
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0]?.allergenCode).toBe("coconut");
    });

    it("matches coconut cream", () => {
      const matches = matchIngredient("coconut cream");
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0]?.allergenCode).toBe("coconut");
    });
  });
});
