import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  BRAND_DISPLAY_FONT,
  BRAND_NAME,
  brandAssets,
  brandPublicPath,
  VERCEL_DEPLOY_URL,
} from "./index";

const assetsDir = join(dirname(fileURLToPath(import.meta.url)), "../assets");
const PNG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

describe("@ovenlovin/brand", () => {
  it("exports the product name as a single word", () => {
    expect(BRAND_NAME).toBe("OvenLovin");
    expect(BRAND_NAME).not.toMatch(/\s/);
  });

  it("uses Fascinate Inline for the wordmark", () => {
    expect(BRAND_DISPLAY_FONT).toBe("Fascinate Inline");
  });

  it("lists every asset and public path", () => {
    const names = Object.keys(brandAssets);
    expect(names).toEqual(Object.keys(brandPublicPath));
    expect(names).toContain("mark");
    expect(names).toContain("wordmark");
    expect(names).toContain("lockup");
    expect(names).toContain("favicon");
    expect(names).toContain("appleTouch");
    expect(names).toContain("og");
  });

  it("ships every listed asset file", () => {
    for (const file of Object.values(brandAssets)) {
      const path = join(assetsDir, file);
      expect(existsSync(path), `${file} should exist`).toBe(true);
    }
  });

  it("keeps the favicon labeled OvenLovin", () => {
    const svg = readFileSync(join(assetsDir, brandAssets.favicon), "utf8");
    expect(svg).toMatch(/^<svg\s|^<\?xml/);
    expect(svg).toContain("OvenLovin");
  });

  it("ships PNG mark, wordmark, lockup, and OG images", () => {
    for (const file of [
      brandAssets.mark,
      brandAssets.wordmark,
      brandAssets.wordmarkDark,
      brandAssets.lockup,
      brandAssets.og,
      brandAssets.appleTouch,
    ]) {
      const bytes = readFileSync(join(assetsDir, file));
      expect(bytes.subarray(0, 8).equals(PNG)).toBe(true);
    }
  });

  it("points the deploy button at Neon, Blob, and Clerk stores", () => {
    expect(VERCEL_DEPLOY_URL).toContain("stores=");
    expect(VERCEL_DEPLOY_URL).toContain("neon");
    expect(VERCEL_DEPLOY_URL).toContain("blob");
    expect(VERCEL_DEPLOY_URL).toContain("clerk");
    expect(VERCEL_DEPLOY_URL).toContain("NEXT_PUBLIC_INSTANCE_NAME");
    expect(VERCEL_DEPLOY_URL).toMatch(/[?&]env=NEXT_PUBLIC_INSTANCE_NAME/);
    expect(VERCEL_DEPLOY_URL).not.toMatch(/[?&]env=[^&]*USDA_FDC_API_KEY/);
    expect(VERCEL_DEPLOY_URL).not.toMatch(/[?&]env=[^&]*AI_GATEWAY_API_KEY/);
    expect(VERCEL_DEPLOY_URL).toContain("OIDC");
  });
});
