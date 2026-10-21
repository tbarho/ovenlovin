import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { brandTokens } from "./brand-tokens";

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

function cssVar(source: string, name: string): string {
  const match = source.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!match?.[1]) throw new Error(`missing ${name} in globals.css`);
  return match[1].toLowerCase();
}

describe("public design contrast", () => {
  const css = readFileSync(path.resolve(__dirname, "../app/globals.css"), "utf8");

  it("keeps CSS tokens aligned with brandTokens", () => {
    expect(cssVar(css, "--orange-press")).toBe(brandTokens.orangePress);
    expect(cssVar(css, "--orange-press-hover")).toBe(brandTokens.orangePressHover);
    expect(cssVar(css, "--muted")).toBe(brandTokens.muted);
    expect(cssVar(css, "--panel")).toBe(brandTokens.panel);
    expect(cssVar(css, "--bg")).toBe(brandTokens.bg);
  });

  it("keeps primary fill, step labels, and footer at or above 4.5:1", () => {
    expect(contrast(brandTokens.bg, brandTokens.orangePress)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(brandTokens.orangePress, brandTokens.panel)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(brandTokens.muted, brandTokens.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(brandTokens.bg, brandTokens.orange)).toBeLessThan(4.5);
  });
});
