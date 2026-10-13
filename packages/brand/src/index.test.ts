import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { BRAND_NAME, brandAssets, brandPublicPath, VERCEL_DEPLOY_URL } from "./index";

const assetsDir = join(dirname(fileURLToPath(import.meta.url)), "../assets");

describe("@ovenlovin/brand", () => {
  it("exports the product name", () => {
    expect(BRAND_NAME).toBe("OvenLovin");
  });

  it("lists every asset and public path", () => {
    const names = Object.keys(brandAssets);
    expect(names).toEqual(Object.keys(brandPublicPath));
    expect(names).toContain("mark");
    expect(names).toContain("logo");
    expect(names).toContain("favicon");
  });

  it("ships valid SVG files for every asset", () => {
    for (const file of Object.values(brandAssets)) {
      const path = join(assetsDir, file);
      expect(existsSync(path), `${file} should exist`).toBe(true);
      const svg = readFileSync(path, "utf8");
      expect(svg).toMatch(/^<svg\s/);
      expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
      expect(svg).toContain("</svg>");
      expect(svg).toContain("OvenLovin");
    }
  });

  it("points the deploy button at Neon, Blob, and Clerk stores", () => {
    expect(VERCEL_DEPLOY_URL).toContain("stores=");
    expect(VERCEL_DEPLOY_URL).toContain("neon");
    expect(VERCEL_DEPLOY_URL).toContain("blob");
    expect(VERCEL_DEPLOY_URL).toContain("clerk");
    expect(VERCEL_DEPLOY_URL).toContain("NEXT_PUBLIC_INSTANCE_NAME");
  });
});
