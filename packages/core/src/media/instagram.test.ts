import { describe, expect, it } from "vitest";
import { classifyImportFailure } from "./import-ai-unavailable";
import {
  cleanInstagramCaption,
  draftFromInstagramCaption,
  instagramCaptionHasRecipe,
  instagramFailurePresentation,
  parseInstagramCaption,
} from "./instagram";
import { importDedupeKeys, prepareImportDraft } from "./prepare-import-draft";
import { canonicalInstagramPermalink, normalizeSourceUrl } from "./source-url";

const CAPTION = `15-minute miso butter pasta 🍝 save this for a weeknight!

Serves 2
8 oz spaghetti
2 tbsp white miso
a splash of soy sauce

1. Boil spaghetti in salted water.
2. Toss with the sauce.

#pasta #weeknightdinner`;

describe("canonicalInstagramPermalink", () => {
  it("canonicalizes reel, reels, and photo posts and strips igsh", () => {
    expect(
      canonicalInstagramPermalink(
        "https://www.instagram.com/reel/C9mIsoButter/?igsh=abc&utm_source=ig"
      )
    ).toEqual({
      permalink: "https://www.instagram.com/reel/C9mIsoButter",
      kind: "reel",
    });
    expect(canonicalInstagramPermalink("https://instagram.com/reels/C9mIsoButter")).toEqual({
      permalink: "https://www.instagram.com/reel/C9mIsoButter",
      kind: "reel",
    });
    expect(canonicalInstagramPermalink("https://m.instagram.com/p/C8sheetPanGn/")).toEqual({
      permalink: "https://www.instagram.com/p/C8sheetPanGn",
      kind: "post",
    });
    expect(
      canonicalInstagramPermalink("https://www.instagram.com/weeknightwithmaya/reel/C9mIsoButter/")
    ).toEqual({
      permalink: "https://www.instagram.com/reel/C9mIsoButter",
      kind: "reel",
    });
    expect(normalizeSourceUrl("https://instagram.com/reels/C9mIsoButter?igsh=1")).toBe(
      "https://www.instagram.com/reel/C9mIsoButter"
    );
  });

  it("ignores profiles and non-Instagram links", () => {
    expect(canonicalInstagramPermalink("https://www.instagram.com/weeknightwithmaya/")).toBeNull();
    expect(canonicalInstagramPermalink("https://www.budgetbytes.com/pasta")).toBeNull();
    expect(normalizeSourceUrl("https://www.budgetbytes.com/pasta/?igsh=1")).toBe(
      "https://www.budgetbytes.com/pasta"
    );
  });
});

describe("parseInstagramCaption", () => {
  it("strips hashtags and emoji, and flags a line with no amount", () => {
    const parsed = parseInstagramCaption(CAPTION);
    expect(cleanInstagramCaption(CAPTION)).not.toMatch(/#|🍝/);
    expect(parsed.title).toBe("15-minute miso butter pasta");
    expect(parsed.servings).toBe(2);
    expect(parsed.steps).toHaveLength(2);
    expect(parsed.ingredients.map((item) => item.rawText)).toEqual([
      "8 oz spaghetti",
      "2 tbsp white miso",
      "a splash of soy sauce",
    ]);
    expect(parsed.ingredients[2]?.hasAmount).toBe(false);
    expect(parsed.ingredients[0]?.hasAmount).toBe(true);
    expect(instagramCaptionHasRecipe(parsed)).toBe(true);
  });

  it("treats a caption with fewer than two ingredients and no steps as not a recipe", () => {
    const parsed = parseInstagramCaption("love this dinner\n\n#pasta");
    expect(instagramCaptionHasRecipe(parsed)).toBe(false);
    expect(() => draftFromInstagramCaption({ caption: "love this dinner #pasta" })).toThrow(
      /no ingredients or steps/
    );
  });

  it("stores Instagram credit and a no-amount field on the draft", () => {
    const draft = draftFromInstagramCaption({
      caption: CAPTION,
      permalink: "https://instagram.com/reels/C9mIsoButter?igsh=1",
      handle: "weeknightwithmaya",
    });
    expect(draft.source).toMatchObject({
      type: "social",
      url: "https://www.instagram.com/reel/C9mIsoButter",
      author: "@weeknightwithmaya",
    });
    expect(draft.source.rawExtractionJson).toMatchObject({
      sourcePlatform: "instagram",
      sourceName: "@weeknightwithmaya",
      kind: "reel",
    });
    expect(draft.uncertainFields).toContain("no-amount:a splash of soy sauce");
    expect(draft.servings).toBe(2);
    const prepared = prepareImportDraft(draft);
    expect(importDedupeKeys(prepared)).toEqual([
      {
        kind: "source_url",
        key: "https://www.instagram.com/reel/C9mIsoButter",
      },
    ]);
  });
});

describe("instagram failures", () => {
  it("classifies a blocked read with next steps, and drops Try again after a second failure", () => {
    const once = instagramFailurePresentation({
      code: "unavailable",
      permalink: "https://www.instagram.com/reel/C9mIsoButter",
      kind: "reel",
    });
    expect(classifyImportFailure(once)).toMatchObject({
      code: "instagram_blocked",
      heading: "Instagram did not let us read this post",
      nextSteps: [
        { id: "retry", label: "Try again" },
        { id: "paste", label: "Paste the caption" },
        { id: "photo", label: "Screenshot it, use Photo import" },
      ],
    });
    const twice = instagramFailurePresentation({ code: "blocked", attempts: 2 });
    expect(twice.heading).toBe("Instagram is still not letting us read it");
    expect(twice.nextSteps.map((step) => step.id)).toEqual(["paste", "photo"]);
    expect(twice.message).toMatch(/Nothing was saved/);
  });
});
