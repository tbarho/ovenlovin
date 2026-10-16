import { describe, expect, it, vi } from "vitest";
import { extractRecipeWithLlm, llmRecipeToJsonLd } from "./llm-recipe";

describe("llmRecipeToJsonLd", () => {
  it("returns null when the model says the page is not a recipe", () => {
    expect(llmRecipeToJsonLd({ isRecipe: false, title: "Example Domain" })).toBeNull();
  });

  it("maps a structured recipe into schema.org Recipe JSON", () => {
    const recipe = llmRecipeToJsonLd({
      isRecipe: true,
      title: "Weeknight Tomato Pasta",
      servings: 4,
      prepTimeMinutes: 10,
      cookTimeMinutes: 15,
      ingredients: [{ text: "12 oz pasta" }, { text: "1 can tomatoes" }],
      steps: [{ text: "Boil the pasta and warm the tomatoes." }],
    });
    expect(recipe?.["@type"]).toBe("Recipe");
    expect(recipe?.name).toBe("Weeknight Tomato Pasta");
    expect(recipe?.recipeYield).toBe("4");
    expect(recipe?.prepTime).toBe("PT10M");
    expect(recipe?.recipeIngredient).toEqual(["12 oz pasta", "1 can tomatoes"]);
    expect(recipe?.recipeInstructions).toEqual([
      { "@type": "HowToStep", text: "Boil the pasta and warm the tomatoes." },
    ]);
  });
});

describe("extractRecipeWithLlm", () => {
  it("skips when the AI gateway is not configured", async () => {
    const generate = vi.fn();
    expect(await extractRecipeWithLlm("Ingredients\n- pasta", { env: {}, generate })).toBeNull();
    expect(generate).not.toHaveBeenCalled();
  });

  it("returns structured JSON-LD from the gateway", async () => {
    const generate = vi.fn().mockResolvedValue({
      object: {
        isRecipe: true,
        title: "Weeknight Tomato Pasta",
        ingredients: [{ text: "12 oz pasta" }, { text: "1 can tomatoes" }],
        steps: [{ text: "Boil pasta. Warm sauce. Combine." }],
      },
    });

    const recipe = await extractRecipeWithLlm("Weeknight Tomato Pasta\nIngredients\n12 oz pasta", {
      env: { AI_GATEWAY_API_KEY: "test-key" },
      generate,
      modelId: "openai/gpt-4o-mini",
    });

    expect(generate).toHaveBeenCalled();
    expect(recipe?.name).toBe("Weeknight Tomato Pasta");
    expect(recipe?.recipeIngredient).toHaveLength(2);
  });

  it("returns null when the model marks the page as not a recipe", async () => {
    const generate = vi.fn().mockResolvedValue({
      object: { isRecipe: false },
    });
    expect(
      await extractRecipeWithLlm("Example Domain", {
        env: { AI_GATEWAY_API_KEY: "test-key" },
        generate,
      })
    ).toBeNull();
  });
});
