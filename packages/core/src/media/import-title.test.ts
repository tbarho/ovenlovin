import { describe, expect, it } from "vitest";
import {
  cleanImportedTitle,
  stripCookbookNamespace,
  stripTrailingRecipeWord,
} from "./import-title";

describe("cleanImportedTitle", () => {
  it("strips the Wikibooks Cookbook namespace", () => {
    expect(stripCookbookNamespace("Cookbook:Pancakes (North American)")).toBe(
      "Pancakes (North American)"
    );
    expect(cleanImportedTitle("Cookbook: Pancake Recipe")).toBe("Pancake");
  });

  it("still strips a trailing Recipe word", () => {
    expect(stripTrailingRecipeWord("Spanish Cauliflower Rice Recipe")).toBe(
      "Spanish Cauliflower Rice"
    );
    expect(cleanImportedTitle("Taco Pasta recipe")).toBe("Taco Pasta");
  });
});
