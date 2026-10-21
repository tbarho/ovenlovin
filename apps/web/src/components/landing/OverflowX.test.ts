import { describe, expect, it } from "vitest";
import { overflowsX } from "./OverflowX";

describe("overflowsX", () => {
  it("is true only when content is wider than the box", () => {
    expect(overflowsX({ scrollWidth: 200, clientWidth: 200 })).toBe(false);
    expect(overflowsX({ scrollWidth: 201, clientWidth: 200 })).toBe(false);
    expect(overflowsX({ scrollWidth: 202, clientWidth: 200 })).toBe(true);
  });
});
