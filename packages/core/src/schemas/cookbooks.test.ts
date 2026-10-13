import { describe, expect, it } from "vitest";
import { slugifyCookbookName } from "./cookbooks";

describe("slugifyCookbookName", () => {
  it("turns a name into a url-safe slug", () => {
    expect(slugifyCookbookName("Weeknight Dinners")).toBe("weeknight-dinners");
  });

  it("falls back when the name has no letters", () => {
    expect(slugifyCookbookName("!!!")).toBe("cookbook");
  });
});
