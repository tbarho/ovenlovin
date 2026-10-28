import { describe, expect, it } from "vitest";
import { isBooksEnabled } from "./jobs";

describe("isBooksEnabled", () => {
  it("is off unless OVENLOVIN_BOOKS is set", () => {
    expect(isBooksEnabled({})).toBe(false);
    expect(isBooksEnabled({ OVENLOVIN_BOOKS: "0" })).toBe(false);
    expect(isBooksEnabled({ OVENLOVIN_BOOKS: "1" })).toBe(true);
    expect(isBooksEnabled({ OVENLOVIN_BOOKS: "true" })).toBe(true);
  });
});
