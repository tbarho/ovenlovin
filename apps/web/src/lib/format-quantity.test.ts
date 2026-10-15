import { describe, expect, it } from "vitest";
import { formatShopQuantity } from "./format-quantity";

describe("formatShopQuantity", () => {
  it("uses cooking fractions instead of repeating decimals", () => {
    expect(formatShopQuantity(1 / 3, "cup")).toBe("1/3 cup");
    expect(formatShopQuantity(0.33, "cup")).toBe("1/3 cup");
    expect(formatShopQuantity(5 / 3, "tbsp")).toBe("1 2/3 tbsp");
    expect(formatShopQuantity(2, "lb")).toBe("2 lb");
  });

  it("omits a missing amount", () => {
    expect(formatShopQuantity(undefined, "cup")).toBeNull();
  });
});
