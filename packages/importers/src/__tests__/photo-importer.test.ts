import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPhotoImporter } from "../importers/photo";
import { runPhotoImport } from "../photo-pipeline";
import { readFileSync } from "fs";
import { join } from "path";

const fixtureDir = join(__dirname, "fixtures/photo");
const handwrittenFixture = JSON.parse(
  readFileSync(join(fixtureDir, "handwritten-ginger-snaps.json"), "utf-8")
);
const printedFixture = JSON.parse(
  readFileSync(join(fixtureDir, "printed-tomato-pasta.json"), "utf-8")
);
const blurryFixture = JSON.parse(readFileSync(join(fixtureDir, "blurry-card.json"), "utf-8"));

function imageDataUrl(name: string): string {
  const bytes = readFileSync(join(fixtureDir, name));
  return `data:image/png;base64,${bytes.toString("base64")}`;
}

vi.mock("ai", () => ({
  generateObject: vi.fn(),
}));

vi.mock("@ai-sdk/gateway", () => ({
  gateway: (id: string) => id,
}));

describe("Photo Importer", () => {
  beforeEach(() => {
    vi.stubEnv("AI_GATEWAY_API_KEY", "test-key");
  });

  const importer = createPhotoImporter({ visionModelId: "spacexai/grok-4.7" });

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
        images: [{ blob: imageDataUrl("handwritten-ginger-snaps.png") }],
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
          maxRetries: 5,
          providerOptions: {
            gateway: { models: ["deepseek/deepseek-v4.1-flash", "openai/gpt-6-luna"] },
          },
        })
      );

      expect(result.sourceType).toBe("photo");
      expect(result.rawData.title).toBe("Grandma's Ginger Snaps");
      expect(result.rawData.isHandwritten).toBe(true);
      expect(result.modelUsed).toBe("spacexai/grok-4.7");
    });

    it("should handle multiple images", async () => {
      const { generateObject } = await import("ai");

      (generateObject as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        object: handwrittenFixture,
      });

      const result = await importer.extract({
        images: [
          { blob: imageDataUrl("printed-tomato-pasta.png") },
          { blob: imageDataUrl("blurry-card.png") },
        ],
      });

      expect(result.sourceBlobs).toHaveLength(2);
      expect(result.rawData.imageCount).toBe(2);

      expect(generateObject).toHaveBeenCalled();
    });

    it("passes a combined abort signal so Cancel can stop the vision job", async () => {
      const { generateObject } = await import("ai");
      const controller = new AbortController();
      (generateObject as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        object: printedFixture,
      });
      const cancellable = createPhotoImporter({
        visionModelId: "spacexai/grok-4.7",
        abortSignal: controller.signal,
      });
      await cancellable.extract({
        images: [{ blob: imageDataUrl("printed-tomato-pasta.png") }],
      });
      expect(generateObject).toHaveBeenCalledWith(
        expect.objectContaining({
          abortSignal: expect.any(AbortSignal),
        })
      );
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
        modelUsed: "spacexai/grok-4.7",
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
      expect(draft.source.blobRefs ?? []).not.toEqual(
        expect.arrayContaining([expect.stringMatching(/^data:/)])
      );
      expect(draft.source.importerName).toBe("photo-importer");
      expect(draft.source.licenseNote).toContain("Personal/family recipe");
      expect(draft.notes).toBe("Chill the dough before rolling.");
      expect(draft.source.attribution).toBe("Grandma's card box");
      expect(draft.uncertainFields).toEqual(
        expect.arrayContaining(["ingredient: baking soda", "step 7"])
      );
      expect(draft.allergenClassifications?.some((hit) => hit.allergenCode === "egg")).toBe(true);
    });

    it("extracts notes, visible source, and allergen hits from a printed card", async () => {
      const draft = await importer.toDraft({
        sourceType: "photo",
        sourceBlobs: [imageDataUrl("printed-tomato-pasta.png")],
        rawData: printedFixture,
        extractedAt: new Date(),
        extractorVersion: "0.1.0",
        modelUsed: "spacexai/grok-4.7",
      });

      expect(draft.title).toBe("Weeknight Tomato Pasta");
      expect(draft.notes).toBe("Salt the pasta water well.");
      expect(draft.source.attribution).toBe("Weeknight Dinners, p. 42");
      expect(draft.uncertainFields).toEqual([]);
      expect(draft.allergenClassifications?.some((hit) => hit.allergenCode === "milk")).toBe(true);
    });

    it("strips Step N: prefixes with the same normalizer as paste", async () => {
      const draft = await importer.toDraft({
        sourceType: "photo",
        sourceBlobs: ["https://example.com/card.jpg"],
        rawData: {
          title: "Test Olive Pancakes",
          servings: 4,
          ingredients: [{ text: "1 cup flour", ingredient: "flour", confidence: "high" }],
          steps: [
            { text: "Step 1: Whisk flour with milk.", confidence: "high" },
            { text: "STEP 2: Rest the batter.", confidence: "high" },
            { text: "3. Cook until golden.", confidence: "high" },
            { text: "1 cup flour", confidence: "high" },
          ],
          ocrQuality: "excellent",
        },
        extractedAt: new Date(),
        extractorVersion: "0.1.0",
        modelUsed: "spacexai/grok-4.7",
      });

      expect(draft.steps.map((step) => step.text)).toEqual([
        "Whisk flour with milk.",
        "Rest the batter.",
        "Cook until golden.",
        "1 cup flour",
      ]);
    });

    it("warns with named uncertain fields for a bad photo", async () => {
      const draft = await importer.toDraft({
        sourceType: "photo",
        sourceBlobs: [imageDataUrl("blurry-card.png")],
        rawData: blurryFixture,
        extractedAt: new Date(),
        extractorVersion: "0.1.0",
        modelUsed: "spacexai/grok-4.7",
      });

      expect(draft.needsReview).toBe(true);
      expect(draft.uncertainFields).toEqual(
        expect.arrayContaining([
          "title",
          "servings",
          "times",
          "ingredient: [unclear line]",
          "step 1",
        ])
      );
      expect(draft.reviewReasons.some((reason) => reason.startsWith("Uncertain fields:"))).toBe(
        true
      );
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

  describe("runPhotoImport", () => {
    it("reads fixture images, mocks the model, and classifies allergens", async () => {
      const { generateObject } = await import("ai");
      (generateObject as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        object: printedFixture,
      });

      const result = await runPhotoImport(
        { images: [{ blob: imageDataUrl("printed-tomato-pasta.png") }] },
        { visionModelId: "spacexai/grok-4.7" }
      );

      expect(generateObject).toHaveBeenCalled();
      expect(result.draft.title).toBe("Weeknight Tomato Pasta");
      expect(result.uncertainFields).toEqual([]);
      expect(result.allergenClassifications.some((hit) => hit.allergenCode === "milk")).toBe(true);
    });
  });
});
