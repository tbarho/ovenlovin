import { describe, expect, it } from "vitest";
import {
  googleTranslateUrl,
  jinaReaderUrl,
  publicCopyRequests,
  relatedRecipeUrls,
  translateGoogUrl,
} from "./public-copies";

describe("public recipe copies", () => {
  const live = "https://www.allrecipes.com/recipe/10813/best-chocolate-chip-cookies/";

  it("builds Jina and Google Translate copies", () => {
    expect(jinaReaderUrl(live)).toBe(`https://r.jina.ai/${live}`);
    expect(googleTranslateUrl(live)).toContain("translate.google.com/translate");
    expect(googleTranslateUrl(live)).toContain(encodeURIComponent(live));
    expect(translateGoogUrl(live)).toContain("www-allrecipes-com.translate.goog");
    expect(translateGoogUrl(live)).toContain("_x_tr_sl=auto");
  });

  it("follows Cookbook pancake titles to the live recipe page", () => {
    expect(relatedRecipeUrls("https://en.wikibooks.org/wiki/Cookbook:Pancakes")).toEqual([
      "https://en.wikibooks.org/wiki/Cookbook:Pancake",
      "https://en.wikibooks.org/wiki/Cookbook:Pancakes_(North_American)",
    ]);
    expect(relatedRecipeUrls("https://en.wikibooks.org/wiki/Cookbook:Pancake")).toEqual([
      "https://en.wikibooks.org/wiki/Cookbook:Pancakes_(North_American)",
    ]);
    expect(relatedRecipeUrls(live)).toEqual([]);
  });

  it("lists cache copies in a stable order", () => {
    expect(publicCopyRequests(live).map((copy) => copy.label)).toEqual([
      "google-translate",
      "translate-goog",
      "jina-html",
      "jina-markdown",
    ]);
  });
});
