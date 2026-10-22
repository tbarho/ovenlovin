import { describe, expect, it } from "vitest";
import { clerkAppearance } from "./ClerkReadyProvider";

describe("clerkAppearance", () => {
  it("puts the visible border on cardBox and leaves card unboxed", () => {
    expect(clerkAppearance.elements.cardBox).toEqual({
      boxShadow: "none",
      border: "1px solid var(--border)",
      borderRadius: "8px",
    });
    expect(clerkAppearance.elements.card).toEqual({
      boxShadow: "none",
      border: "none",
      borderRadius: "0",
    });
  });

  it("sizes the Clerk title at 20/600/28", () => {
    expect(clerkAppearance.elements.headerTitle).toEqual({
      fontSize: "20px",
      fontWeight: 600,
      lineHeight: "28px",
    });
  });
});
