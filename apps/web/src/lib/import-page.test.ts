import { describe, expect, it } from "vitest";
import { BadRequestError } from "@/lib/api/errors";
import { parseCapturedPage, parseCaptureHash } from "./import-page";

describe("parseCapturedPage", () => {
  it("reads a bookmarklet form body with JSON-LD", () => {
    const parsed = parseCapturedPage({
      url: "https://www.foodnetwork.com/recipes/alton-brown/the-chewy-recipe-1909047",
      jsonLd: JSON.stringify({
        "@type": "Recipe",
        name: "The Chewy",
      }),
    });
    expect(parsed.url).toContain("foodnetwork.com");
    expect(parsed.jsonLd?.name).toBe("The Chewy");
  });

  it("reads captured HTML when there is no JSON-LD", () => {
    const parsed = parseCapturedPage({
      url: "https://en.wikibooks.org/wiki/Cookbook:Pancakes_(North_American)",
      html: "<html><body><h1>Pancake</h1></body></html>",
    });
    expect(parsed.html).toMatch(/Pancake/);
    expect(parsed.jsonLd).toBeUndefined();
  });

  it("rejects a body with no page payload", () => {
    try {
      parseCapturedPage({ url: "https://www.budgetbytes.com/beef-stroganoff/" });
      throw new Error("expected parseCapturedPage to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestError);
      expect((error as BadRequestError).detail).toMatch(/HTML or JSON-LD/);
    }
  });

  it("reads a bookmarklet hash payload", () => {
    const parsed = parseCaptureHash(
      `#${encodeURIComponent(
        JSON.stringify({
          url: "https://www.budgetbytes.com/beef-stroganoff/",
          jsonLd: { "@type": "Recipe", name: "Beef Stroganoff" },
        })
      )}`
    );
    expect(parsed.jsonLd?.name).toBe("Beef Stroganoff");
  });

  it("rejects an empty capture hash", () => {
    try {
      parseCaptureHash("#");
      throw new Error("expected parseCaptureHash to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestError);
      expect((error as BadRequestError).detail).toMatch(/No page was sent/);
    }
  });
});
