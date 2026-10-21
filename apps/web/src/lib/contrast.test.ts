import { describe, expect, it } from "vitest";

function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace("#", "");
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ];
}

function channel(value: number): number {
  const scaled = value / 255;
  return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
}

function contrast(foreground: string, background: string): number {
  const [fr, fg, fb] = hexToRgb(foreground);
  const [br, bg, bb] = hexToRgb(background);
  const l1 = 0.2126 * channel(fr) + 0.7152 * channel(fg) + 0.0722 * channel(fb);
  const l2 = 0.2126 * channel(br) + 0.7152 * channel(bg) + 0.0722 * channel(bb);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

describe("public design contrast", () => {
  it("keeps primary fill, step labels, and footer at or above 4.5:1", () => {
    expect(contrast("#ffffff", "#B85420")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#B85420", "#fffdf9")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#5c564c", "#ffffff")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#ffffff", "#E07A3D")).toBeLessThan(4.5);
  });
});
