import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPasteImporter } from "../importers/paste";
import { readFileSync } from "fs";
import { join } from "path";

const fixtureText = readFileSync(
  join(__dirname, "fixtures/paste/chocolate-chip-cookies.txt"),
  "utf-8"
);

vi.mock("ai", () => ({
  generateObject: vi.fn(),
}));

vi.mock("@ai-sdk/gateway", () => ({
  gateway: (id: string) => id,
}));

vi.mock("@ai-sdk/openai", () => ({
  createOpenAI: () => () => "mock-model",
}));

describe("Paste Importer", () => {
  beforeEach(() => {
    vi.stubEnv("AI_GATEWAY_API_KEY", "test-key");
  });

  const importer = createPasteImporter({ modelId: "spacexai/grok-4.7" });

  describe("canHandle", () => {
    it("should accept non-empty text", () => {
      expect(importer.canHandle({ text: "Recipe text" })).toBe(true);
      expect(importer.canHandle({ text: "  Some recipe  " })).toBe(true);
    });

    it("should reject empty text", () => {
      expect(importer.canHandle({ text: "" })).toBe(false);
      expect(importer.canHandle({ text: "   " })).toBe(false);
    });
  });

  describe("extract", () => {
    it("should extract recipe using LLM", async () => {
      const { generateObject } = await import("ai");

      (generateObject as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        object: {
          title: "Classic Chocolate Chip Cookies",
          description: "The best chocolate chip cookies",
          servings: 24,
          prepTimeMinutes: 15,
          cookTimeMinutes: 12,
          totalTimeMinutes: 27,
          ingredients: [
            {
              text: "2 1/4 cups all-purpose flour",
              quantity: "2 1/4",
              unit: "cups",
              ingredient: "all-purpose flour",
            },
          ],
          steps: [{ text: "Preheat oven to 375°F (190°C)." }],
        },
      });

      const result = await importer.extract({ text: fixtureText });

      expect(generateObject).toHaveBeenCalledWith(
        expect.objectContaining({
          schema: expect.any(Object),
          prompt: expect.stringContaining("Extract recipe data"),
          maxRetries: 2,
          abortSignal: expect.any(AbortSignal),
          providerOptions: {
            gateway: { models: ["openai/gpt-6-luna"] },
          },
        })
      );

      expect(result.sourceType).toBe("paste");
      expect(result.rawData.title).toBe("Classic Chocolate Chip Cookies");
      expect(result.modelUsed).toBe("spacexai/grok-4.7");
    });

    it("should include optional URL and author", async () => {
      const { generateObject } = await import("ai");

      (generateObject as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        object: {
          title: "Test Recipe",
          ingredients: [],
          steps: [],
        },
      });

      const result = await importer.extract({
        text: "Recipe text",
        url: "https://example.com",
        author: "Chef Baker",
      });

      expect(result.sourceUrl).toBe("https://example.com");
      expect(result.author).toBe("Chef Baker");
    });

    it("rethrows a gateway 502 as import AI unavailable", async () => {
      const { generateObject } = await import("ai");
      const { isImportAiUnavailable } = await import("@ovenlovin/core/import-ai-unavailable");
      const error = Object.assign(new Error("Bad gateway"), {
        name: "AI_APICallError",
        statusCode: 502,
      });
      (generateObject as ReturnType<typeof vi.fn>).mockRejectedValueOnce(error);
      await expect(importer.extract({ text: "Recipe text" })).rejects.toBe(error);
      expect(isImportAiUnavailable(error)).toBe(true);
    });

    it("tags a generateObject timeout as import AI unavailable", async () => {
      const { generateObject } = await import("ai");
      const { isImportAiUnavailable } = await import("@ovenlovin/core/import-ai-unavailable");
      const error = Object.assign(new Error("aborted"), { name: "TimeoutError" });
      (generateObject as ReturnType<typeof vi.fn>).mockRejectedValueOnce(error);
      await expect(importer.extract({ text: "Recipe text" })).rejects.toBe(error);
      expect(isImportAiUnavailable(error)).toBe(true);
    });
  });

  describe("toDraft", () => {
    it("should convert extracted data to recipe draft", async () => {
      const rawExtraction = {
        sourceType: "paste" as const,
        rawData: {
          title: "Classic Chocolate Chip Cookies",
          description: "The best chocolate chip cookies",
          servings: 24,
          prepTimeMinutes: 15,
          cookTimeMinutes: 12,
          totalTimeMinutes: 27,
          notes: "Chill the dough overnight.",
          ingredients: [
            {
              text: "2 1/4 cups all-purpose flour",
              quantity: "2 1/4",
              unit: "cups",
              ingredient: "all-purpose flour",
            },
            {
              text: "1 cup butter, softened",
              quantity: "1",
              unit: "cup",
              ingredient: "butter",
              preparation: "softened",
            },
          ],
          steps: [
            { text: "Preheat oven to 375°F (190°C)." },
            { text: "Combine flour, baking soda, and salt in a small bowl." },
          ],
        },
        extractedAt: new Date(),
        extractorVersion: "0.1.0",
        modelUsed: "spacexai/grok-4.7",
      };

      const draft = await importer.toDraft(rawExtraction);

      expect(draft.title).toBe("Classic Chocolate Chip Cookies");
      expect(draft.description).toBe("The best chocolate chip cookies");
      expect(draft.servings).toBe(24);
      expect(draft.prepTimeMinutes).toBe(15);
      expect(draft.cookTimeMinutes).toBe(12);
      expect(draft.totalTimeMinutes).toBe(27);
      expect(draft.notes).toBe("Chill the dough overnight.");

      expect(draft.ingredients).toHaveLength(2);
      expect(draft.ingredients[0].rawText).toBe("2 1/4 cups all-purpose flour");
      expect(draft.ingredients[0].quantity).toEqual({ min: 2.25 });
      expect(draft.ingredients[0].unit).toBe("cups");
      expect(draft.ingredients[0].ingredient).toBe("all-purpose flour");
      expect(draft.ingredients[0].confidence).toBeGreaterThan(0.8);

      expect(draft.ingredients[1].preparation).toBe("softened");

      expect(draft.steps).toHaveLength(2);
      expect(draft.steps[0].text).toContain("Preheat oven");
      expect(draft.steps[0].order).toBe(0);
      expect(draft.steps[0].confidence).toBeGreaterThan(0.8);

      expect(draft.overallConfidence).toBeGreaterThan(0.8);
      expect(draft.needsReview).toBe(false);

      expect(draft.source.type).toBe("paste");
      expect(draft.source.importerName).toBe("paste-importer");
      expect(draft.source.modelUsed).toBe("spacexai/grok-4.7");
    });

    it("should handle missing ingredient quantity", async () => {
      const rawExtraction = {
        sourceType: "paste" as const,
        rawData: {
          title: "Test Recipe",
          ingredients: [
            {
              text: "some flour",
              ingredient: "flour",
            },
          ],
          steps: [{ text: "Mix everything together well" }],
        },
        extractedAt: new Date(),
        extractorVersion: "0.1.0",
      };

      const draft = await importer.toDraft(rawExtraction);

      expect(draft.ingredients[0].quantity).toBeUndefined();
      expect(draft.ingredients[0].confidence).toBeLessThan(0.85);
      expect(draft.ingredients[0].confidenceReasons).toContain("Missing quantity");
    });

    it("accepts ingredients without steps when isRecipe is omitted", async () => {
      const draft = await importer.toDraft({
        sourceType: "paste",
        rawData: {
          title: "Guacamole",
          ingredients: [
            { text: "2 avocados", ingredient: "avocados" },
            { text: "1 lime", ingredient: "lime" },
            { text: "salt", ingredient: "salt" },
          ],
        },
        extractedAt: new Date(),
        extractorVersion: "0.1.0",
      });
      expect(draft.ingredients).toHaveLength(3);
      expect(draft.steps).toHaveLength(0);
    });

    it("rejects junk paste that is not a recipe", async () => {
      await expect(
        importer.toDraft({
          sourceType: "paste",
          rawData: {
            isRecipe: false,
            title: "Hello",
            ingredients: [],
            steps: [],
          },
          extractedAt: new Date(),
          extractorVersion: "0.1.0",
        })
      ).rejects.toMatchObject({
        name: "RecipeNotFoundError",
        message: expect.stringMatching(/couldn't find a recipe/),
      });
    });

    it("should parse quantity ranges", async () => {
      const rawExtraction = {
        sourceType: "paste" as const,
        rawData: {
          title: "Test Recipe",
          ingredients: [
            {
              text: "2-3 cups flour",
              quantity: "2-3",
              unit: "cups",
              ingredient: "flour",
            },
          ],
          steps: [{ text: "Mix well" }],
        },
        extractedAt: new Date(),
        extractorVersion: "0.1.0",
      };

      const draft = await importer.toDraft(rawExtraction);

      expect(draft.ingredients[0].quantity).toEqual({ min: 2, max: 3 });
    });

    it("should parse fractions", async () => {
      const rawExtraction = {
        sourceType: "paste" as const,
        rawData: {
          title: "Test Recipe",
          ingredients: [
            {
              text: "1/4 cup sugar",
              quantity: "1/4",
              unit: "cup",
              ingredient: "sugar",
            },
          ],
          steps: [{ text: "Mix well" }],
        },
        extractedAt: new Date(),
        extractorVersion: "0.1.0",
      };

      const draft = await importer.toDraft(rawExtraction);

      expect(draft.ingredients[0].quantity?.min).toBe(0.25);
    });

    it("parses unicode paste fractions and flags unparseable amounts", async () => {
      const draft = await importer.toDraft({
        sourceType: "paste",
        rawData: {
          title: "Olive fractions",
          ingredients: [
            { text: "½ cup sugar", quantity: "½", unit: "cup", ingredient: "sugar" },
            { text: "1 ½ cups flour", quantity: "1 ½", unit: "cups", ingredient: "flour" },
            { text: "¾ tsp salt", quantity: "¾", unit: "tsp", ingredient: "salt" },
            { text: "⅓ cup oil", quantity: "⅓", unit: "cup", ingredient: "oil" },
            { text: "a handful of herbs", quantity: "a handful", ingredient: "herbs" },
          ],
          steps: [{ text: "Stir until combined well." }],
        },
        extractedAt: new Date(),
        extractorVersion: "0.1.0",
      });

      expect(draft.ingredients[0]?.quantity).toEqual({ min: 0.5 });
      expect(draft.ingredients[1]?.quantity).toEqual({ min: 1.5 });
      expect(draft.ingredients[2]?.quantity).toEqual({ min: 0.75 });
      expect(draft.ingredients[3]?.quantity).toEqual({ min: 0.33 });
      expect(draft.ingredients[4]?.quantity).toBeUndefined();
      expect(draft.needsReview).toBe(true);
      expect(draft.reviewReasons.some((reason) => reason.includes("Unparseable quantity"))).toBe(
        true
      );
    });

    it("should extract timers from steps", async () => {
      const rawExtraction = {
        sourceType: "paste" as const,
        rawData: {
          title: "Test Recipe",
          ingredients: [{ text: "flour" }],
          steps: [{ text: "Bake for 30 minutes at 350°F" }, { text: "Let cool for 10 minutes" }],
        },
        extractedAt: new Date(),
        extractorVersion: "0.1.0",
      };

      const draft = await importer.toDraft(rawExtraction);

      expect(draft.steps[0].timers?.length).toBeGreaterThan(0);
      expect(draft.steps[0].timers?.[0].duration).toBe(30);
      expect(draft.steps[1].timers?.[0].duration).toBe(10);
    });

    it("should flag very short steps", async () => {
      const rawExtraction = {
        sourceType: "paste" as const,
        rawData: {
          title: "Test Recipe",
          ingredients: [{ text: "flour" }],
          steps: [{ text: "Mix" }],
        },
        extractedAt: new Date(),
        extractorVersion: "0.1.0",
      };

      const draft = await importer.toDraft(rawExtraction);

      expect(draft.steps[0].confidence).toBeLessThan(0.85);
      expect(draft.steps[0].confidenceReasons).toContain("Very short step");
    });
  });
});
