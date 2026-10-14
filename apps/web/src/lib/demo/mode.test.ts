import { describe, expect, it } from "vitest";
import {
  assertDemoModeSafeForBuild,
  getPublicDemoUrl,
  isDemoModeEnabled,
  isDemoModeRequested,
  isDemoProjectConfirmed,
  isProductVercelProduction,
  isVercelProductionBuild,
} from "./mode";

describe("demo mode gate", () => {
  it("is requested when OVENLOVIN_DEMO_MODE=1", () => {
    expect(isDemoModeRequested({ OVENLOVIN_DEMO_MODE: "1" })).toBe(true);
    expect(isDemoModeRequested({ OVENLOVIN_DEMO_MODE: "true" })).toBe(true);
  });

  it("is not requested when the flag is unset or junk", () => {
    expect(isDemoModeRequested({})).toBe(false);
    expect(isDemoModeRequested({ OVENLOVIN_DEMO_MODE: "yes" })).toBe(false);
    expect(isDemoModeRequested({ NODE_ENV: "production" })).toBe(false);
  });

  it("never enables on product Vercel production even if the flag is set", () => {
    expect(
      isDemoModeEnabled({
        NODE_ENV: "production",
        VERCEL: "1",
        VERCEL_ENV: "production",
        OVENLOVIN_DEMO_MODE: "1",
      })
    ).toBe(false);
  });

  it("enables on the dedicated demo Vercel project production", () => {
    expect(
      isDemoModeEnabled({
        NODE_ENV: "production",
        VERCEL: "1",
        VERCEL_ENV: "production",
        OVENLOVIN_DEMO_MODE: "1",
        OVENLOVIN_DEMO_PROJECT: "1",
      })
    ).toBe(true);
  });

  it("enables locally when the flag is set", () => {
    expect(isDemoModeEnabled({ NODE_ENV: "development", OVENLOVIN_DEMO_MODE: "1" })).toBe(true);
  });

  it("treats VERCEL_ENV=production without DEMO_PROJECT as product production", () => {
    expect(isProductVercelProduction({ VERCEL_ENV: "production", NODE_ENV: "production" })).toBe(
      true
    );
    expect(
      isProductVercelProduction({
        VERCEL_ENV: "production",
        OVENLOVIN_DEMO_PROJECT: "1",
      })
    ).toBe(false);
  });

  it("treats VERCEL=1 + NODE_ENV=production as a Vercel production build", () => {
    expect(isVercelProductionBuild({ VERCEL: "1", NODE_ENV: "production" })).toBe(true);
  });

  it("fails the product production build when demo mode is requested", () => {
    expect(() =>
      assertDemoModeSafeForBuild({
        NODE_ENV: "production",
        VERCEL: "1",
        VERCEL_ENV: "production",
        OVENLOVIN_DEMO_MODE: "1",
      })
    ).toThrow(/cannot be enabled on the product Vercel production project/i);
  });

  it("allows the dedicated demo project to build with demo mode", () => {
    expect(() =>
      assertDemoModeSafeForBuild({
        NODE_ENV: "production",
        VERCEL: "1",
        VERCEL_ENV: "production",
        OVENLOVIN_DEMO_MODE: "1",
        OVENLOVIN_DEMO_PROJECT: "1",
      })
    ).not.toThrow();
  });

  it("allows a local or CI build with the demo flag", () => {
    expect(() =>
      assertDemoModeSafeForBuild({ NODE_ENV: "production", OVENLOVIN_DEMO_MODE: "1" })
    ).not.toThrow();
  });

  it("allows product production when demo mode is unset", () => {
    expect(() =>
      assertDemoModeSafeForBuild({
        NODE_ENV: "production",
        VERCEL: "1",
        VERCEL_ENV: "production",
      })
    ).not.toThrow();
  });

  it("reads NEXT_PUBLIC_DEMO_URL without a trailing slash", () => {
    expect(getPublicDemoUrl({ NEXT_PUBLIC_DEMO_URL: "https://demo.example/" })).toBe(
      "https://demo.example"
    );
    expect(getPublicDemoUrl({})).toBeNull();
  });

  it("treats OVENLOVIN_DEMO_PROJECT=true as confirmation", () => {
    expect(isDemoProjectConfirmed({ OVENLOVIN_DEMO_PROJECT: "true" })).toBe(true);
  });
});
