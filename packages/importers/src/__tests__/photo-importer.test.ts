import { describe, it, expect, vi } from "vitest";
import { createPhotoImporter } from "../importers/photo";
import { readFileSync } from "fs";
import { join } from "path";

const handwrittenFixture = JSON.parse(
  readFileSync(join(__dirname, "fixtures/photo/handwritten-ginger-snaps.json"), "utf-8")
);

vi.mock("ai", () => ({
  generateObject: vi.fn(),
}));

vi.mock("@ai-sdk/openai", () => ({
  createOpenAI: () => () => "mock-model",
}));

describe("Photo Importer", () => {
  const importer = createPhotoImporter({ visionModelId: "openai/gpt-4o" });

  describe("canHandle", () => {
    it("should accept images", () => {
      expect(
        importer.canHandle({
          images: [{ blob: "data:image/jpeg;base64,..." }],
        })
      ).toBe(true);
    });

    it("should reject empty images array", () => {
      expect(importer.canHandle({ images: [] })).toBe(false);
    });
  });

  describe("extract", () => {
    it("should extract recipe from handwritten card", async () => {
      const { generateObject } = await import("ai");

      (generateObject as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        object: handwrittenFixture,
      });

      const result = await importer.extract({
        images: [{ blob: "data:image/jpeg;base64,fake" }],
        isHandwritten: true,
      });

      expect(generateObject).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.arrayContaining([
                expect.objectContaining({
                  type: "text",
                  text: expect.stringContaining("HANDWRITTEN"),
                }),
              ]),
            }),
          ]),
          schema: expect.any(Object),
        })
      );

      expect(result.sourceType).toBe("photo");
      expect(result.rawData.title).toBe("Grandma's Ginger Snaps");
      expect(result.rawData.isHandwritten).toBe(true);
      expect(result.modelUsed).toBe("openai/gpt-4o");
    });

    it("should handle multiple images", async () => {
      const { generateObject } = await import("ai");

      (generateObject as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        object: handwrittenFixture,
      });

      const result = await importer.extract({
        images: [
          { blob: "data:image/jpeg;base64,page1" },
          { blob: "data:image/jpeg;base64,page2" },
        ],
      });

      expect(result.sourceBlobs).toHaveLength(2);
      expect(result.rawData.imageCount).toBe(2);

      expect(generateObject).toHaveBeenCalled();
    });
  });

  describe("toDraft", () => {
    it("should convert handwritten recipe with confidence penalties", async () => {
      const rawExtraction = {
        sourceType: "photo" as const,
        sourceBlobs: ["data:image/jpeg;base64,fake"],
        rawData: {
          ...handwrittenFixture,
          isHandwritten: true,
          imageCount: 1,
        },
        extractedAt: new Date(),
        extractorVersion: "0.1.0",
        modelUsed: "openai/gpt-4o",
      };

      const draft = await importer.toDraft(rawExtraction);

      expect(draft.title).toBe("Grandma's Ginger Snaps");
      expect(draft.servings).toBe(48);
      expect(draft.cookTimeMinutes).toBe(10);

      expect(draft.ingredients).toHaveLength(9);

      expect(draft.ingredients[0].rawText).toBe("3/4 c. shortening");
      expect(draft.ingredients[0].quantity).toEqual({ min: 0.75 });
      expect(draft.ingredients[0].unit).toBe("c.");
      expect(draft.ingredients[0].confidence).toBeLessThan(0.6);
      expect(draft.ingredients[0].confidenceReasons).toContain("Handwritten text");

      const lowConfidenceIngredient = draft.ingredients.find((i) =>
        i.rawText.includes("baking soda")
      );
      expect(lowConfidenceIngredient?.confidence).toBeLessThan(0.45);
      expect(lowConfidenceIngredient?.confidenceReasons).toContain("Low OCR confidence");

      expect(draft.steps).toHaveLength(7);
      expect(draft.steps[0].text).toContain("Mix shortening");

      const lowConfidenceStep = draft.steps.find((s) => s.text.includes("Bake"));
      expect(lowConfidenceStep?.confidence).toBeLessThan(0.45);

      expect(draft.needsReview).toBe(true);
      expect(draft.reviewReasons).toContain("Handwritten recipe card - verify OCR accuracy");
      expect(draft.reviewReasons).toContain("OCR quality: fair");

      expect(draft.source.type).toBe("photo");
      expect(draft.source.importerName).toBe("photo-importer");
      expect(draft.source.licenseNote).toContain("Personal/family recipe");
    });

    it("should apply fair quality penalties", async () => {
      const rawExtraction = {
        sourceType: "photo" as const,
        rawData: {
          title: "Test Recipe",
          ingredients: [
            {
              text: "flour",
              ingredient: "flour",
              confidence: "high",
            },
          ],
          steps: [
            {
              text: "Mix ingredients together well",
              confidence: "high",
            },
          ],
          ocrQuality: "fair",
          isHandwritten: false,
        },
        extractedAt: new Date(),
        extractorVersion: "0.1.0",
      };

      const draft = await importer.toDraft(rawExtraction);

      expect(draft.ingredients[0].confidence).toBeLessThan(0.85);
      expect(draft.ingredients[0].confidenceReasons).toContain("OCR quality: fair");
    });

    it("should apply poor quality penalties", async () => {
      const rawExtraction = {
        sourceType: "photo" as const,
        rawData: {
          title: "Test Recipe",
          ingredients: [
            {
              text: "flour",
              ingredient: "flour",
              confidence: "medium",
            },
          ],
          steps: [
            {
              text: "Mix ingredients together well",
              confidence: "medium",
            },
          ],
          ocrQuality: "poor",
          isHandwritten: true,
        },
        extractedAt: new Date(),
        extractorVersion: "0.1.0",
      };

      const draft = await importer.toDraft(rawExtraction);

      expect(draft.ingredients[0].confidence).toBeLessThan(0.4);
      expect(draft.ingredients[0].confidenceReasons).toContain("Poor image quality");
      expect(draft.reviewReasons).toContain("OCR quality: poor");
    });

    it("should mark illegible fields with very low confidence", async () => {
      const rawExtraction = {
        sourceType: "photo" as const,
        rawData: {
          title: "Test Recipe",
          ingredients: [
            {
              text: "[illegible ingredient line]",
              confidence: "illegible",
            },
          ],
          steps: [
            {
              text: "[illegible step]",
              confidence: "illegible",
            },
          ],
          ocrQuality: "poor",
        },
        extractedAt: new Date(),
        extractorVersion: "0.1.0",
      };

      const draft = await importer.toDraft(rawExtraction);

      expect(draft.ingredients[0].confidence).toBeLessThan(0.3);
      expect(draft.ingredients[0].confidenceReasons).toContain("Illegible text in source");

      expect(draft.steps[0].confidence).toBeLessThan(0.3);
      expect(draft.steps[0].confidenceReasons).toContain("Illegible text in source");
    });

    it("should extract timers from steps", async () => {
      const rawExtraction = {
        sourceType: "photo" as const,
        rawData: {
          title: "Test Recipe",
          ingredients: [{ text: "flour" }],
          steps: [
            {
              text: "Bake 10-12 min. at 375°.",
              confidence: "high",
            },
          ],
          ocrQuality: "good",
        },
        extractedAt: new Date(),
        extractorVersion: "0.1.0",
      };

      const draft = await importer.toDraft(rawExtraction);

      expect(draft.steps[0].timers?.length).toBeGreaterThan(0);
      expect(draft.steps[0].timers?.[0].duration).toBeGreaterThan(0);
    });

    it("should include handwrittenNotes in review reasons", async () => {
      const rawExtraction = {
        sourceType: "photo" as const,
        rawData: {
          title: "Test Recipe",
          ingredients: [{ text: "flour", confidence: "high" }],
          steps: [{ text: "Mix well", confidence: "high" }],
          ocrQuality: "fair",
          handwrittenNotes: "Temperature partially smudged",
        },
        extractedAt: new Date(),
        extractorVersion: "0.1.0",
      };

      const draft = await importer.toDraft(rawExtraction);

      expect(draft.reviewReasons).toContain("Legibility notes: Temperature partially smudged");
    });
  });
});
