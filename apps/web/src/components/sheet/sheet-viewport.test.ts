import { describe, expect, it } from "vitest";
import { fieldNeedsScroll, visualViewportBox } from "./sheet-viewport";

describe("visualViewportBox", () => {
  it("uses the visual viewport height and offset", () => {
    expect(visualViewportBox({ height: 480, offsetTop: 24 }, 844)).toEqual({
      height: 480,
      top: 24,
    });
  });

  it("falls back when visualViewport is missing", () => {
    expect(visualViewportBox(undefined, 844)).toEqual({ height: 844, top: 0 });
  });
});

describe("fieldNeedsScroll", () => {
  it("is false when the field is fully inside the scroller", () => {
    expect(fieldNeedsScroll({ top: 120, bottom: 160 }, { top: 80, bottom: 400 })).toBe(false);
  });

  it("is true when the field sits under the keyboard inset", () => {
    expect(fieldNeedsScroll({ top: 390, bottom: 430 }, { top: 80, bottom: 400 })).toBe(true);
  });
});
