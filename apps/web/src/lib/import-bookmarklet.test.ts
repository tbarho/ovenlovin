import { describe, expect, it } from "vitest";
import { buildImportBookmarklet, importBookmarkletTitle } from "./import-bookmarklet";

describe("import bookmarklet", () => {
  it("sends JSON-LD or HTML to the same-origin capture page", () => {
    const href = buildImportBookmarklet("https://ovenlovin-demo.vercel.app/");
    expect(href.startsWith("javascript:")).toBe(true);
    const source = decodeURIComponent(href.slice("javascript:".length));
    expect(source).toContain("https://ovenlovin-demo.vercel.app");
    expect(source).toContain("/recipes/import/capture#");
    expect(source).toContain("application/ld+json");
    expect(source).toContain("payload.jsonLd");
    expect(source).toContain("document.documentElement.outerHTML");
    expect(source).toContain("encodeURIComponent(JSON.stringify(payload))");
    expect(importBookmarkletTitle()).toBe("Save to OvenLovin");
  });
});
