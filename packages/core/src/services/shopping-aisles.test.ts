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
    expect(assignAisle("chives")).toMatchObject({
      aisle: "Produce",
      category: "produce",
      canonicalName: "chives",
    });
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

  it("keeps the original name unless it is an exact alias or has an explicit canonical", () => {
    expect(canonicalShopName("almond milk")).toBe("almond milk");
    expect(canonicalShopName("oat milk")).toBe("oat milk");
    expect(canonicalShopName("vegan butter")).toBe("vegan butter");
    expect(canonicalShopName("goat cheese")).toBe("goat cheese");
    expect(canonicalShopName("beef short ribs")).toBe("beef short ribs");
  });

  it("merges plain flour with all purpose flour", () => {
    expect(canonicalShopName("flour")).toBe("all purpose flour");
    expect(canonicalShopName("all-purpose flour")).toBe("all purpose flour");
    expect(canonicalShopName("plain all purpose flour")).toBe("all purpose flour");
    expect(canonicalShopName("bread flour")).toBe("bread flour");
    expect(canonicalShopName("almond flour")).toBe("almond flour");
    expect(canonicalShopName("rice flour")).toBe("rice flour");
    expect(canonicalShopName("whole wheat flour")).toBe("whole wheat flour");
  });

  it("merges descriptor variants of the same grocery", () => {
    expect(canonicalShopName("unsalted butter")).toBe("butter");
    expect(canonicalShopName("salted butter")).toBe("butter");
    expect(canonicalShopName("cold butter")).toBe("butter");
    expect(canonicalShopName("softened butter")).toBe("butter");
    expect(canonicalShopName("melted butter")).toBe("butter");
    expect(canonicalShopName("Parmesan cheese")).toBe("parmesan");
    expect(canonicalShopName("parmigiano reggiano")).toBe("parmesan");
    expect(canonicalShopName("vanilla extract")).toBe("vanilla");
    expect(canonicalShopName("pure vanilla extract")).toBe("vanilla");
    expect(canonicalShopName("goat cheese")).toBe("goat cheese");
    expect(canonicalShopName("vegan butter")).toBe("vegan butter");
    expect(canonicalShopName("cream cheese")).toBe("cream cheese");
    expect(canonicalShopName("cream")).toBe("cream");
    expect(canonicalShopName("lemon extract")).toBe("lemon extract");
    expect(assignAisle("lemon extract")).toMatchObject({
      aisle: "Baking",
      category: "pantry",
    });
    expect(canonicalShopName("lemon")).toBe("lemon");
    expect(canonicalShopName("mint extract")).toBe("mint extract");
    expect(assignAisle("mint extract")).toMatchObject({
      aisle: "Baking",
      category: "pantry",
    });
    expect(canonicalShopName("fresh mint")).toBe("fresh mint");
    expect(canonicalShopName("whole chicken")).toBe("whole chicken");
    expect(canonicalShopName("salted peanuts")).toBe("salted peanuts");
    expect(canonicalShopName("unsalted peanuts")).toBe("unsalted peanuts");
    expect(canonicalShopName("fresh thyme")).toBe("fresh thyme");
    expect(canonicalShopName("dried thyme")).toBe("dried thyme");
    expect(canonicalShopName("potato")).toBe("potato");
    expect(canonicalShopName("potatoes")).toBe("potatoes");
    expect(canonicalShopName("tomato")).toBe("tomato");
    expect(canonicalShopName("tomatoes")).toBe("tomatoes");
    expect(canonicalShopName("cherry tomatoes")).toBe("cherry tomatoes");
    expect(assignAisle("fresh thyme").aisle).toBe("Produce");
    expect(assignAisle("dried thyme").aisle).toBe("Spices");
  });
});

describe("canned and plant-milk aisles", () => {
  it("files cans and crushed tomatoes as canned goods", () => {
    expect(assignAisle("crushed tomatoes")).toMatchObject({
      aisle: "Canned goods",
      category: "pantry",
      canonicalName: "crushed tomatoes",
    });
    expect(assignAisle("crushed tomato")).toMatchObject({
      aisle: "Canned goods",
      category: "pantry",
      canonicalName: "crushed tomatoes",
    });
    expect(assignAisle("crushed pineapple")).toMatchObject({
      aisle: "Canned goods",
      category: "pantry",
      canonicalName: "crushed pineapple",
    });
    expect(assignAisle("tomatoes", "can")).toMatchObject({
      aisle: "Canned goods",
      category: "pantry",
    });
    expect(assignAisle("canned beans")).toMatchObject({
      aisle: "Canned goods",
      category: "pantry",
    });
    expect(assignAisle("canned tomatoes")).toMatchObject({
      aisle: "Canned goods",
      category: "pantry",
    });
    expect(assignAisle("tomato")).toMatchObject({ aisle: "Produce" });
    expect(assignAisle("red pepper flakes").aisle).not.toBe("Canned goods");
    expect(assignAisle("graham crackers").aisle).not.toBe("Canned goods");
    expect(assignAisle("garlic").aisle).not.toBe("Canned goods");
  });

  it("keeps oat, almond, and soy milk out of Dairy", () => {
    expect(assignAisle("oat milk").aisle).not.toBe("Dairy");
    expect(assignAisle("almond milk").aisle).not.toBe("Dairy");
    expect(assignAisle("soy milk").aisle).not.toBe("Dairy");
    expect(assignAisle("milk")).toMatchObject({ aisle: "Dairy" });
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
