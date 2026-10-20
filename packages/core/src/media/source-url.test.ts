import { describe, expect, it } from "vitest";
import { normalizeSourceUrl } from "./source-url";

describe("normalizeSourceUrl", () => {
  it("drops tracking params, hash, and a trailing slash", () => {
    expect(
      normalizeSourceUrl(
        "https://WWW.BudgetBytes.com/beef-stroganoff/?utm_source=x&fbclid=1#comments"
      )
    ).toBe("https://www.budgetbytes.com/beef-stroganoff");
  });

  it("returns null for blank input", () => {
    expect(normalizeSourceUrl("  ")).toBeNull();
  });
});
