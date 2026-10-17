import { afterEach, describe, expect, it, vi } from "vitest";
import { createUrlImporter } from "../importers/url";
import { extractJsonLd, RecipeNotFoundError } from "../utils/url";
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
      expect(draft.nutrition).toEqual({
        perServing: true,
        calories: 186,
        protein: 2,
        carbohydrates: 25,
        fat: 9,
      });
      expect(draft.prepTimeMinutes).toBe(15);
      expect(draft.cookTimeMinutes).toBe(12);
      expect(draft.totalTimeMinutes).toBe(27);
      expect(draft.cuisine).toBe("American");
      expect(draft.course).toBe("Dessert");

      expect(draft.ingredients).toHaveLength(9);
      expect(draft.ingredients[0].rawText).toBe("2 1/4 cups all-purpose flour");
      expect(draft.ingredients[0].quantity?.min).toBe(2.25);
      expect(draft.ingredients[0].unit).toBe("cup");
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

    it("falls back to page og:image when schema.org has no image", async () => {
      const { image: _image, ...withoutImage } = chocolateChipCookiesJson;
      const draft = await importer.toDraft({
        sourceType: "url",
        sourceUrl: "https://example.com/cookies",
        pageImages: ["https://example.com/og.jpg"],
        rawData: withoutImage,
        extractedAt: new Date(),
        extractorVersion: "0.1.0",
      });
      expect(draft.images).toEqual(["https://example.com/og.jpg"]);
    });

    it("stores only one schema.org image even when the recipe lists a gallery", async () => {
      const draft = await importer.toDraft({
        sourceType: "url",
        sourceUrl: "https://example.com/cookies",
        pageImages: ["https://example.com/og.jpg", "https://example.com/tw.jpg"],
        rawData: {
          ...chocolateChipCookiesJson,
          image: [
            { url: "https://example.com/thumb.jpg", width: 200, height: 200 },
            { url: "https://example.com/hero.jpg", width: 1600, height: 900 },
          ],
        },
        extractedAt: new Date(),
        extractorVersion: "0.1.0",
      });
      expect(draft.images).toEqual(["https://example.com/hero.jpg"]);
    });

    it("stores only the first page image when schema.org has no image", async () => {
      const { image: _image, ...withoutImage } = chocolateChipCookiesJson;
      const draft = await importer.toDraft({
        sourceType: "url",
        sourceUrl: "https://example.com/cookies",
        pageImages: ["https://example.com/og.jpg", "https://example.com/tw.jpg"],
        rawData: withoutImage,
        extractedAt: new Date(),
        extractorVersion: "0.1.0",
      });
      expect(draft.images).toEqual(["https://example.com/og.jpg"]);
    });

    it("parses array recipeYield and strips a trailing Recipe from the title", async () => {
      const draft = await importer.toDraft({
        sourceType: "url",
        sourceUrl: "https://example.com/cauliflower",
        rawData: {
          ...chocolateChipCookiesJson,
          name: "Spanish Cauliflower Rice Recipe",
          recipeYield: ["6 servings"],
          notes: "Rinse the cauliflower well.",
        },
        extractedAt: new Date(),
        extractorVersion: "0.1.0",
      });
      expect(draft.title).toBe("Spanish Cauliflower Rice");
      expect(draft.servings).toBe(6);
      expect(draft.notes).toBe("Rinse the cauliflower well.");
    });

    it("decodes HTML entities in titles and text", async () => {
      const draft = await importer.toDraft({
        sourceType: "url",
        sourceUrl: "https://www.seriouseats.com/the-food-lab-best-chocolate-chip-cookie-recipe",
        rawData: {
          ...chocolateChipCookiesJson,
          name: "The Food Lab&#39;s Chocolate Chip Cookies",
          description: "Brown butter &amp; chocolate.",
          recipeIngredient: ["1 cup unsalted butter", "12 oz chocolate chips"],
          recipeInstructions: [
            { "@type": "HowToStep", text: "Cream the butter. It&#39;s ready when pale." },
          ],
        },
        extractedAt: new Date(),
        extractorVersion: "0.1.0",
      });
      expect(draft.title).toBe("The Food Lab's Chocolate Chip Cookies");
      expect(draft.description).toBe("Brown butter & chocolate.");
      expect(draft.steps[0]?.text).toBe("Cream the butter. It's ready when pale.");
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

  describe("extract fallbacks", () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    const prosePage = `<!doctype html><html><head><title>Grandma soup</title></head>
      <body><h1>Grandma soup</h1>
      <p>This family soup uses a chicken, carrots, celery, onion, noodles, salt, and pepper.</p>
      <p>Simmer the chicken, add the vegetables, then stir in the noodles until tender.</p>
      <p>More copy so the page is a complete document and not treated as a challenge wall.</p>
      </body></html>`;

    it("uses the LLM for a Wikibooks-like page with no recipe markup", async () => {
      const overview = `<!doctype html><html><head><title>Cookbook:Pancake</title></head>
        <body><h1>Cookbook:Pancake</h1>
        <p>Pancakes are made from a thin batter cooked on a griddle.</p>
        <p>A typical batter uses 1 cup flour, 1 cup milk, 1 egg, and 2 tablespoons butter.</p>
        <p>Mix the batter, then cook until bubbles form and flip once.</p>
        </body></html>`;
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          statusText: "OK",
          url: "https://en.wikibooks.org/wiki/Cookbook:Pancake",
          text: async () => overview,
        })
      );
      const extractWithLlm = vi.fn(async () => ({
        "@type": "Recipe",
        name: "Pancake",
        recipeIngredient: ["1 cup flour", "1 cup milk", "1 egg", "2 tablespoons butter"],
        recipeInstructions: [
          { "@type": "HowToStep", text: "Mix the batter and cook on a griddle." },
        ],
      }));

      const raw = await createUrlImporter({ extractWithLlm }).extract({
        url: "https://en.wikibooks.org/wiki/Cookbook:Pancake",
      });
      expect(extractWithLlm).toHaveBeenCalled();
      expect(String(extractWithLlm.mock.calls[0]?.[0])).toMatch(/1 cup flour/);
      expect(raw.rawData.name).toBe("Pancake");
    });

    it("extracts captured JSON-LD without fetching the URL", async () => {
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);
      const importer = createUrlImporter();
      const raw = await importer.extract({
        url: "https://www.budgetbytes.com/beef-stroganoff/",
        jsonLd: {
          "@type": "Recipe",
          name: "Beef Stroganoff",
          recipeIngredient: ["1 lb beef", "8 oz noodles"],
          recipeInstructions: [
            { "@type": "HowToStep", text: "Brown the beef and stir in noodles." },
          ],
        },
      });
      expect(fetchMock).not.toHaveBeenCalled();
      expect(raw.rawData.name).toBe("Beef Stroganoff");
      expect(raw.sourceUrl).toBe("https://www.budgetbytes.com/beef-stroganoff/");
      expect(raw.extractorVersion).toBe("0.1.0");
    });

    it("extracts captured HTML without fetching the URL", async () => {
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);
      const html = `<html><body>
        <h1>Weeknight Tomato Pasta</h1>
        <h2>Ingredients</h2>
        <ul><li>12 oz pasta</li><li>1 can tomatoes</li><li>2 Tbsp olive oil</li></ul>
        <h2>Instructions</h2>
        <ol><li>Boil the pasta.</li><li>Warm the tomatoes.</li><li>Combine and serve.</li></ol>
      </body></html>`;
      const raw = await createUrlImporter().extract({
        url: "https://example-blog.test/weeknight-tomato-pasta/",
        html,
      });
      expect(fetchMock).not.toHaveBeenCalled();
      expect(String(raw.rawData.name)).toMatch(/tomato pasta/i);
    });

    it("uses the LLM when JSON-LD and HTML extract miss", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          statusText: "OK",
          url: "https://example-blog.test/grandma-soup",
          text: async () => prosePage,
        })
      );

      const importer = createUrlImporter({
        extractWithLlm: async () => ({
          "@type": "Recipe",
          name: "Grandma soup",
          recipeIngredient: ["1 chicken", "2 carrots", "2 celery stalks"],
          recipeInstructions: [{ "@type": "HowToStep", text: "Simmer and add noodles." }],
        }),
      });

      const raw = await importer.extract({ url: "https://example-blog.test/grandma-soup" });
      expect(raw.rawData.name).toBe("Grandma soup");
      expect(raw.rawData.recipeIngredient).toHaveLength(3);
    });

    it("says no recipe found when every extract layer misses", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          statusText: "OK",
          url: "https://example.com/",
          text: async () =>
            `<!doctype html><html><head><title>Example Domain</title></head>
             <body><h1>Example Domain</h1>
             <p>This domain is for use in illustrative examples in documents. You may use this domain in literature without prior coordination or asking for permission.</p>
             </body></html>`,
        })
      );

      await expect(
        createUrlImporter({ extractWithLlm: async () => null }).extract({
          url: "https://example.com/",
        })
      ).rejects.toMatchObject({
        name: "RecipeNotFoundError",
        message: "No recipe found on this page.",
      });
      expect(RecipeNotFoundError).toBeTruthy();
    });
  });
});
