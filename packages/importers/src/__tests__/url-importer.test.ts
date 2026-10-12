import { describe, it, expect } from "vitest";
import { createUrlImporter } from "../importers/url";
import { extractJsonLd } from "../utils/url";
import chocolateChipCookiesJson from "./fixtures/url/chocolate-chip-cookies.json";

describe("URL Importer", () => {
  const importer = createUrlImporter();

  describe("canHandle", () => {
    it("should accept http and https URLs", () => {
      expect(importer.canHandle({ url: "https://example.com/recipe" })).toBe(true);
      expect(importer.canHandle({ url: "http://example.com/recipe" })).toBe(true);
    });

    it("should reject invalid URLs", () => {
      expect(importer.canHandle({ url: "not-a-url" })).toBe(false);
      expect(importer.canHandle({ url: "ftp://example.com" })).toBe(false);
    });
  });

  describe("toDraft", () => {
    it("should convert JSON-LD to recipe draft", async () => {
      const rawExtraction = {
        sourceType: "url" as const,
        sourceUrl: "https://example.com/cookies",
        author: "Chef Baker",
        rawData: chocolateChipCookiesJson,
        extractedAt: new Date(),
        extractorVersion: "0.1.0",
      };

      const draft = await importer.toDraft(rawExtraction);

      expect(draft.title).toBe("Classic Chocolate Chip Cookies");
      expect(draft.description).toContain("chocolate chip cookies");
      expect(draft.servings).toBe(24);
      expect(draft.prepTimeMinutes).toBe(15);
      expect(draft.cookTimeMinutes).toBe(12);
      expect(draft.totalTimeMinutes).toBe(27);
      expect(draft.cuisine).toBe("American");
      expect(draft.course).toBe("Dessert");

      expect(draft.ingredients).toHaveLength(9);
      expect(draft.ingredients[0].rawText).toBe("2 1/4 cups all-purpose flour");
      expect(draft.ingredients[0].confidence).toBe(1.0);

      expect(draft.steps).toHaveLength(6);
      expect(draft.steps[0].text).toContain("Preheat oven");
      expect(draft.steps[0].order).toBe(0);
      expect(draft.steps[0].confidence).toBe(1.0);

      expect(draft.images).toContain("https://example.com/cookies.jpg");

      expect(draft.overallConfidence).toBeGreaterThan(0.9);
      expect(draft.needsReview).toBe(false);

      expect(draft.source.type).toBe("url");
      expect(draft.source.author).toBe("Chef Baker");
      expect(draft.source.importerName).toBe("url-importer");
    });

    it("should extract timers from steps", async () => {
      const rawExtraction = {
        sourceType: "url" as const,
        sourceUrl: "https://example.com/cookies",
        rawData: chocolateChipCookiesJson,
        extractedAt: new Date(),
        extractorVersion: "0.1.0",
      };

      const draft = await importer.toDraft(rawExtraction);

      const bakeStep = draft.steps.find((s) => s.text.includes("Bake"));
      expect(bakeStep?.timers).toBeDefined();
      expect(bakeStep?.timers.length).toBeGreaterThan(0);
    });
  });

  describe("extractJsonLd", () => {
    it("should extract JSON-LD from HTML script tag", () => {
      const html = `
        <html>
          <head>
            <script type="application/ld+json">
              ${JSON.stringify(chocolateChipCookiesJson)}
            </script>
          </head>
        </html>
      `;

      const result = extractJsonLd(html);
      expect(result).toBeDefined();
      expect(result?.["@type"]).toBe("Recipe");
      expect(result?.name).toBe("Classic Chocolate Chip Cookies");
    });

    it("should find Recipe in an array of JSON-LD", () => {
      const html = `
        <html>
          <head>
            <script type="application/ld+json">
              [
                {
                  "@type": "WebSite",
                  "name": "Recipe Site"
                },
                ${JSON.stringify(chocolateChipCookiesJson)}
              ]
            </script>
          </head>
        </html>
      `;

      const result = extractJsonLd(html);
      expect(result).toBeDefined();
      expect(result?.["@type"]).toBe("Recipe");
    });

    it("should find Recipe in @graph", () => {
      const html = `
        <html>
          <head>
            <script type="application/ld+json">
              {
                "@context": "https://schema.org",
                "@graph": [
                  {
                    "@type": "WebSite",
                    "name": "Recipe Site"
                  },
                  ${JSON.stringify(chocolateChipCookiesJson)}
                ]
              }
            </script>
          </head>
        </html>
      `;

      const result = extractJsonLd(html);
      expect(result).toBeDefined();
      expect(result?.["@type"]).toBe("Recipe");
    });

    it("should return null if no Recipe found", () => {
      const html = `
        <html>
          <head>
            <script type="application/ld+json">
              {
                "@type": "WebSite",
                "name": "Not a recipe"
              }
            </script>
          </head>
        </html>
      `;

      const result = extractJsonLd(html);
      expect(result).toBeNull();
    });
  });
});
