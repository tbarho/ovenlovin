import { describe, expect, it, vi } from "vitest";
import { instagramImportDraft, pasteOnlyAdapter } from "../importers/instagram";

describe("PasteOnlyAdapter", () => {
  it("never fetches Instagram and reports the link as unavailable", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const read = await pasteOnlyAdapter.readInstagramPost(
      "https://www.instagram.com/reel/C9mIsoButter/?igsh=1"
    );
    expect(read).toEqual({
      ok: false,
      code: "unavailable",
      permalink: "https://www.instagram.com/reel/C9mIsoButter",
      kind: "reel",
    });
    await expect(
      instagramImportDraft({
        source: "url",
        content: "https://www.instagram.com/p/C8sheetPanGn/",
      })
    ).rejects.toMatchObject({ failureCode: "instagram_blocked" });
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("leaves a normal recipe URL to the existing importer", async () => {
    await expect(
      instagramImportDraft({
        source: "url",
        content: "https://www.budgetbytes.com/pasta",
      })
    ).resolves.toBeNull();
  });

  it("turns a pasted caption into a credited preview", async () => {
    const draft = await instagramImportDraft({
      source: "paste",
      content: "Miso pasta\n\nServes 2\n8 oz spaghetti\n2 tbsp butter\n\n1. Boil the pasta.",
      sourceUrl: "https://www.instagram.com/reel/C9mIsoButter/?igsh=1",
      creator: "@weeknightwithmaya",
    });
    expect(draft?.source.author).toBe("@weeknightwithmaya");
    expect(draft?.source.url).toBe("https://www.instagram.com/reel/C9mIsoButter");
    expect(draft?.title).toMatch(/Miso pasta/);
    expect(draft?.ingredients.length).toBeGreaterThanOrEqual(2);
  });
});
