import { describe, expect, it } from "vitest";
import {
  googleTranslateUrl,
  jinaReaderUrl,
  parseWaybackAvailable,
  publicCopyRequests,
  relatedRecipeUrls,
  translateGoogUrl,
  waybackIdentityUrl,
  waybackMachineUrl,
} from "./public-copies";

describe("public recipe copies", () => {
  const live = "https://www.allrecipes.com/recipe/10813/best-chocolate-chip-cookies/";

  it("builds Wayback identity and playback URLs", () => {
    expect(waybackIdentityUrl(live)).toContain("web/2id_/");
    expect(waybackMachineUrl(live)).toContain("web/2/");
    expect(jinaReaderUrl(live)).toBe(`https://r.jina.ai/${live}`);
  });

  it("builds Google Translate copies", () => {
    expect(googleTranslateUrl(live)).toContain("translate.google.com/translate");
    expect(googleTranslateUrl(live)).toContain(encodeURIComponent(live));
    expect(translateGoogUrl(live)).toContain("www-allrecipes-com.translate.goog");
    expect(translateGoogUrl(live)).toContain("_x_tr_sl=auto");
  });

  it("follows Cookbook:Pancakes to the live Wikibooks title", () => {
    expect(relatedRecipeUrls("https://en.wikibooks.org/wiki/Cookbook:Pancakes")).toEqual([
      "https://en.wikibooks.org/wiki/Cookbook:Pancake",
    ]);
    expect(relatedRecipeUrls(live)).toEqual([]);
  });

  it("lists cache copies in a stable order", () => {
    expect(publicCopyRequests(live).map((copy) => copy.label)).toEqual([
      "wayback-identity",
      "wayback",
      "jina-html",
      "jina-markdown",
      "google-translate",
      "translate-goog",
    ]);
  });

  it("reads a Wayback available snapshot", () => {
    const json = JSON.stringify({
      archived_snapshots: {
        closest: {
          available: true,
          timestamp: "20240101120000",
          url: "http://web.archive.org/web/20240101120000/https://www.budgetbytes.com/beef-stroganoff/",
        },
      },
    });
    expect(parseWaybackAvailable(json)).toBe(
      "https://web.archive.org/web/20240101120000id_/https://www.budgetbytes.com/beef-stroganoff/"
    );
    expect(parseWaybackAvailable('{"archived_snapshots":{}}')).toBeNull();
  });
});
