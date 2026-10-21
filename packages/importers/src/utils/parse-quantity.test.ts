import { describe, expect, it } from "vitest";
import { parseQuantityString } from "./parse-quantity";

describe("parseQuantityString", () => {
  it("parses unicode fractions without dropping the half", () => {
    expect(parseQuantityString("½ cup")).toEqual({ min: 0.5 });
    expect(parseQuantityString("1 ½ cups")).toEqual({ min: 1.5 });
    expect(parseQuantityString("¾ tsp")).toEqual({ min: 0.75 });
    expect(parseQuantityString("⅓ cup")).toEqual({ min: 0.33 });
  });

  it("returns undefined for unparseable amounts", () => {
    expect(parseQuantityString("a handful")).toBeUndefined();
  });
});
