import { describe, expect, it } from "vitest";
import { slugifyTitle } from "./recipes";

describe("slugifyTitle", () => {
  it("turns a title into a url-safe slug", () => {
    expect(slugifyTitle("Chocolate Chip Cookies")).toBe("chocolate-chip-cookies");
  });

  it("falls back when the title has no letters", () => {
    expect(slugifyTitle("!!!")).toBe("recipe");
  });
});
