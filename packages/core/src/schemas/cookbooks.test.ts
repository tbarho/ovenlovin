import { describe, expect, it } from "vitest";
import {
  createCookbookBodySchema,
  slugifyCookbookName,
  updateCookbookBodySchema,
} from "./cookbooks";

describe("cookbook write bodies", () => {
  it("rejects blank and empty cookbook writes", () => {
    expect(createCookbookBodySchema.safeParse({}).success).toBe(false);
    expect(updateCookbookBodySchema.safeParse({}).success).toBe(false);
    expect(createCookbookBodySchema.parse({ name: " Weeknights " }).name).toBe("Weeknights");
  });
});

describe("slugifyCookbookName", () => {
  it("turns a name into a url-safe slug", () => {
    expect(slugifyCookbookName("Weeknight Dinners")).toBe("weeknight-dinners");
  });

  it("falls back when the name has no letters", () => {
    expect(slugifyCookbookName("!!!")).toBe("cookbook");
  });
});
