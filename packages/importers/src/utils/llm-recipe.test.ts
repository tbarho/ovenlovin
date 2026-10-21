import { describe, expect, it, vi } from "vitest";

vi.mock("@ai-sdk/gateway", () => ({
  gateway: (id: string) => id,
}));

import { isImportAiUnavailable } from "@ovenlovin/core/import-ai-unavailable";
import { extractRecipeWithLlm, llmRecipeSchema, llmRecipeToJsonLd } from "./llm-recipe";

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

describe("llmRecipeSchema", () => {
  it("treats strict-output 0 / empty / null as unknown", () => {
    const parsed = llmRecipeSchema.parse({
      isRecipe: true,
      title: "slow-roasted tomatoes",
      description: "",
      servings: 0,
      prepTimeMinutes: 0,
      cookTimeMinutes: "",
      totalTimeMinutes: null,
      notes: 0,
      cuisine: "",
      course: null,
    });
    expect(parsed.servings).toBeUndefined();
    expect(parsed.description).toBeUndefined();
    expect(parsed.prepTimeMinutes).toBeUndefined();
    expect(parsed.cookTimeMinutes).toBeUndefined();
    expect(parsed.totalTimeMinutes).toBeUndefined();
    expect(parsed.notes).toBeUndefined();
    expect(parsed.cuisine).toBeUndefined();
    expect(parsed.course).toBeUndefined();
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
      modelId: "spacexai/grok-4.7",
    });

    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({
        maxRetries: 2,
        abortSignal: expect.any(AbortSignal),
        providerOptions: {
          gateway: { models: ["openai/gpt-6-luna"] },
        },
      })
    );
    expect(generate.mock.calls[0]?.[0].providerOptions.gateway.only).toBeUndefined();
    expect(recipe?.name).toBe("Weeknight Tomato Pasta");
    expect(recipe?.recipeIngredient).toHaveLength(2);
  });

  it("rethrows when the AI provider is unavailable", async () => {
    const error = Object.assign(new Error("Failed after 3 attempts"), { name: "AI_RetryError" });
    const generate = vi.fn().mockRejectedValue(error);
    await expect(
      extractRecipeWithLlm("Ingredients\n- pasta", {
        env: { AI_GATEWAY_API_KEY: "test-key" },
        generate,
        modelId: "openai/gpt-6-luna",
      })
    ).rejects.toBe(error);
  });

  it("pins DeepSeek to the DeepSeek gateway host", async () => {
    const generate = vi.fn().mockResolvedValue({ object: { isRecipe: false } });
    await extractRecipeWithLlm("Example Domain", {
      env: { AI_GATEWAY_API_KEY: "test-key" },
      generate,
      modelId: "deepseek/deepseek-v4.1-flash",
    });
    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({
        providerOptions: { gateway: { only: ["deepseek"] } },
      })
    );
    expect(generate.mock.calls[0]?.[0].providerOptions.gateway.models).toBeUndefined();
  });

  it("rethrows a schema miss from the model", async () => {
    const error = Object.assign(new Error("No object generated: response did not match schema"), {
      name: "AI_NoObjectGeneratedError",
    });
    const generate = vi.fn().mockRejectedValue(error);
    await expect(
      extractRecipeWithLlm("Ingredients\n- pasta", {
        env: { AI_GATEWAY_API_KEY: "test-key" },
        generate,
      })
    ).rejects.toThrow(/No object generated/);
  });

  it("rethrows a hung-model timeout as AI unavailable", async () => {
    const error = Object.assign(new Error("aborted"), { name: "TimeoutError" });
    const generate = vi.fn().mockRejectedValue(error);
    await expect(
      extractRecipeWithLlm("Ingredients\n- pasta", {
        env: { AI_GATEWAY_API_KEY: "test-key" },
        generate,
      })
    ).rejects.toBe(error);
    expect(isImportAiUnavailable(error)).toBe(true);
  });

  it("throws when the request budget is already gone before generateObject", async () => {
    const generate = vi.fn();
    await expect(
      extractRecipeWithLlm("Ingredients\n- pasta", {
        env: { AI_GATEWAY_API_KEY: "test-key" },
        generate,
        startedAt: Date.now() - 50_000,
      })
    ).rejects.toSatisfy((error) => isImportAiUnavailable(error));
    expect(generate).not.toHaveBeenCalled();
  });

  it("passes the remaining request budget to generateObject", async () => {
    const generate = vi.fn().mockResolvedValue({ object: { isRecipe: false } });
    await extractRecipeWithLlm("Ingredients\n- pasta", {
      env: { AI_GATEWAY_API_KEY: "test-key" },
      generate,
      startedAt: Date.now() - 40_000,
    });
    const abortSignal = generate.mock.calls[0]?.[0]?.abortSignal as AbortSignal;
    expect(abortSignal).toBeInstanceOf(AbortSignal);
    expect(abortSignal.aborted).toBe(false);
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
