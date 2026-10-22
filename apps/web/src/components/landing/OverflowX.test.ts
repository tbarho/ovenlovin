import { describe, expect, it } from "vitest";
import { overflowsX } from "./OverflowX";

describe("overflowsX", () => {
  it("is true only when more content sits past the right edge", () => {
    expect(overflowsX({ scrollWidth: 200, clientWidth: 200, scrollLeft: 0 })).toBe(false);
    expect(overflowsX({ scrollWidth: 201, clientWidth: 200, scrollLeft: 0 })).toBe(false);
    expect(overflowsX({ scrollWidth: 202, clientWidth: 200, scrollLeft: 0 })).toBe(true);
  });

  it("is false when scrolled to the end", () => {
    expect(overflowsX({ scrollWidth: 300, clientWidth: 200, scrollLeft: 100 })).toBe(false);
    expect(overflowsX({ scrollWidth: 300, clientWidth: 200, scrollLeft: 98 })).toBe(true);
  });
});
