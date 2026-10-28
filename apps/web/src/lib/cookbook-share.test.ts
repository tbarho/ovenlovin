import { describe, expect, it, vi } from "vitest";

vi.mock("@ovenlovin/db", () => ({ getDatabase: () => ({}) }));

import { isClerkProtectedPath, isClerkProtectExempt } from "./clerk-protect";
import { loadSharedBook, presentShare, sharedBookPath } from "./cookbook-share";

const TOKEN = `olbook_${"a".repeat(43)}`;
const COOKBOOK = { id: "c1", householdId: "h1" };
const BOOK = { id: "c1", title: "Family", subtitle: null, pages: [] };

describe("cookbook share", () => {
  it("hands out a reader path, never the raw token alone", () => {
    expect(sharedBookPath(TOKEN)).toBe(`/read/${TOKEN}`);
    expect(presentShare({ token: TOKEN, blocked: null })).toEqual({
      path: `/read/${TOKEN}`,
      blocked: null,
    });
    expect(presentShare({ token: null, blocked: "No." })).toEqual({ path: null, blocked: "No." });
  });

  it("keeps the reader outside the signed-in kitchen", () => {
    expect(isClerkProtectedPath(sharedBookPath(TOKEN))).toBe(false);
    expect(isClerkProtectExempt(sharedBookPath(TOKEN))).toBe(true);
  });

  it("loads the book from the cookbook's own kitchen", async () => {
    const load = vi.fn(async () => BOOK);
    const book = await loadSharedBook(TOKEN, {
      shares: { resolveLink: async () => "c1" },
      cookbooks: { getCookbook: async () => COOKBOOK as any },
      load,
    });
    expect(book).toBe(BOOK);
    expect(load).toHaveBeenCalledWith("c1", "h1");
  });

  it("is null for a revoked or blocked link, or a deleted cookbook", async () => {
    const load = vi.fn(async () => BOOK);
    const revoked = await loadSharedBook(TOKEN, {
      shares: { resolveLink: async () => null },
      cookbooks: { getCookbook: async () => COOKBOOK as any },
      load,
    });
    const deleted = await loadSharedBook(TOKEN, {
      shares: { resolveLink: async () => "c1" },
      cookbooks: { getCookbook: async () => null },
      load,
    });
    expect(revoked).toBeNull();
    expect(deleted).toBeNull();
    expect(load).not.toHaveBeenCalled();
  });
});
