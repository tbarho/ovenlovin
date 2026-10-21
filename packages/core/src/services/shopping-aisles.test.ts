import { describe, expect, it } from "vitest";
import {
  assignAisle,
  canonicalIngredientName,
  canonicalShopName,
  isPantryStaple,
} from "./shopping-aisles";

describe("assignAisle", () => {
  it("maps fixture grocery names to store sections", () => {
    expect(assignAisle("yellow onion")).toMatchObject({ aisle: "Produce", category: "produce" });
    expect(assignAisle("shredded mozzarella")).toMatchObject({ aisle: "Dairy", category: "dairy" });
    expect(assignAisle("ziti")).toMatchObject({ aisle: "Grains", category: "grains" });
    expect(assignAisle("olive oil")).toMatchObject({
      aisle: "Oils & vinegar",
      category: "pantry",
    });
    expect(assignAisle("acorn squash")).toMatchObject({ aisle: "Produce", category: "produce" });
  });

  it("places carrots and other common produce, not Other", () => {
    expect(assignAisle("carrots")).toMatchObject({ aisle: "Produce", category: "produce" });
    expect(assignAisle("4 carrots")).toMatchObject({ aisle: "Produce", category: "produce" });
    expect(assignAisle("celery")).toMatchObject({ aisle: "Produce", category: "produce" });
    expect(assignAisle("cauliflower")).toMatchObject({ aisle: "Produce", category: "produce" });
    expect(assignAisle("sweet potatoes")).toMatchObject({ aisle: "Produce", category: "produce" });
  });

  it("uses protein for meat and seafood, and distinct store aisles", () => {
    expect(assignAisle("chicken thighs")).toMatchObject({ aisle: "Meat", category: "protein" });
    expect(assignAisle("salmon")).toMatchObject({ aisle: "Seafood", category: "protein" });
    expect(assignAisle("tofu")).toMatchObject({ aisle: "Refrigerated", category: "protein" });
    expect(assignAisle("extra-firm tofu")).toMatchObject({
      aisle: "Refrigerated",
      category: "protein",
    });
    expect(assignAisle("kalamata olives")).toMatchObject({
      aisle: "Canned goods",
      category: "pantry",
    });
    expect(assignAisle("1/2 cup kalamata olives")).toMatchObject({
      aisle: "Canned goods",
      category: "pantry",
    });
  });

  it("does not put black pepper in produce", () => {
    expect(assignAisle("black pepper")).toMatchObject({ aisle: "Spices", category: "spices" });
    expect(assignAisle("bell pepper")).toMatchObject({ aisle: "Produce", category: "produce" });
  });

  it("maps frozen and pantry staples", () => {
    expect(assignAisle("frozen peas and carrots")).toMatchObject({
      aisle: "Frozen",
      category: "frozen",
    });
    expect(assignAisle("all-purpose flour")).toMatchObject({ aisle: "Baking", category: "pantry" });
    expect(assignAisle("bread flour")).toMatchObject({ aisle: "Baking", category: "pantry" });
  });

  it("keeps stock and greens out of Meat and Oils", () => {
    expect(assignAisle("chicken stock")).toMatchObject({ aisle: "Pantry", category: "pantry" });
    expect(assignAisle("vegetable stock")).toMatchObject({ aisle: "Pantry", category: "pantry" });
    expect(assignAisle("arugula")).toMatchObject({ aisle: "Produce", category: "produce" });
    expect(assignAisle("yellow onion")).toMatchObject({
      aisle: "Produce",
      canonicalName: "onion",
    });
    expect(assignAisle("minced garlic")).toMatchObject({
      aisle: "Produce",
      canonicalName: "garlic",
    });
  });
});

describe("canonicalIngredientName", () => {
  it("collapses salt variants to salt", () => {
    expect(canonicalIngredientName("salt")).toBe("salt");
    expect(canonicalIngredientName("kosher salt")).toBe("salt");
    expect(canonicalIngredientName("sea salt")).toBe("salt");
    expect(canonicalIngredientName("table salt")).toBe("salt");
  });

  it("merges lemon and lemons to lemon", () => {
    expect(canonicalShopName("lemon")).toBe("lemon");
    expect(canonicalShopName("lemons")).toBe("lemon");
    expect(canonicalShopName("eggs")).toBe("egg");
    expect(canonicalShopName("yellow onion")).toBe("onion");
    expect(canonicalShopName("salmon fillets")).toBe("salmon");
  });
});

describe("isPantryStaple", () => {
  it("treats salt and oil as pantry staples", () => {
    expect(isPantryStaple("salt")).toBe(true);
    expect(isPantryStaple("kosher salt")).toBe(true);
    expect(isPantryStaple("olive oil")).toBe(true);
    expect(isPantryStaple("sesame oil")).toBe(true);
    expect(isPantryStaple("yellow onion")).toBe(false);
    expect(isPantryStaple("bell peppers")).toBe(false);
    expect(isPantryStaple("soy sauce")).toBe(false);
  });
});
