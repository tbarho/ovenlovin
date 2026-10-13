import { describe, expect, it } from "vitest";
import {
  assertE2eAuthBypassSafeForBuild,
  isE2eAuthBypassEnabled,
  isE2eAuthBypassRequested,
  isVercelProductionBuild,
} from "./e2e-auth";

describe("e2e auth bypass gate", () => {
  it("is requested when NODE_ENV=test", () => {
    expect(isE2eAuthBypassRequested({ NODE_ENV: "test" })).toBe(true);
  });

  it("is requested when E2E_AUTH_BYPASS=1", () => {
    expect(isE2eAuthBypassRequested({ E2E_AUTH_BYPASS: "1", NODE_ENV: "development" })).toBe(true);
  });

  it("is not requested in a normal production build", () => {
    expect(isE2eAuthBypassRequested({ NODE_ENV: "production" })).toBe(false);
  });

  it("never enables on a Vercel production build even if the flag is set", () => {
    expect(
      isE2eAuthBypassEnabled({
        NODE_ENV: "production",
        VERCEL: "1",
        VERCEL_ENV: "production",
        E2E_AUTH_BYPASS: "1",
      })
    ).toBe(false);
  });

  it("enables locally when the flag is set", () => {
    expect(isE2eAuthBypassEnabled({ NODE_ENV: "development", E2E_AUTH_BYPASS: "1" })).toBe(true);
  });

  it("enables under NODE_ENV=test when not on Vercel production", () => {
    expect(isE2eAuthBypassEnabled({ NODE_ENV: "test" })).toBe(true);
  });

  it("treats VERCEL_ENV=production as a Vercel production build", () => {
    expect(isVercelProductionBuild({ VERCEL_ENV: "production", NODE_ENV: "production" })).toBe(
      true
    );
  });

  it("fails the production build when the bypass is requested", () => {
    expect(() =>
      assertE2eAuthBypassSafeForBuild({
        NODE_ENV: "production",
        VERCEL: "1",
        VERCEL_ENV: "production",
        E2E_AUTH_BYPASS: "1",
      })
    ).toThrow(/cannot be enabled in a Vercel production build/i);
  });

  it("fails the production build when NODE_ENV=test is set on Vercel production", () => {
    expect(() =>
      assertE2eAuthBypassSafeForBuild({
        NODE_ENV: "test",
        VERCEL: "1",
        VERCEL_ENV: "production",
      })
    ).toThrow(/cannot be enabled in a Vercel production build/i);
  });

  it("allows a local or CI build with the bypass flag", () => {
    expect(() =>
      assertE2eAuthBypassSafeForBuild({ NODE_ENV: "production", E2E_AUTH_BYPASS: "1" })
    ).not.toThrow();
  });

  it("allows a Vercel production build when the bypass is unset", () => {
    expect(() =>
      assertE2eAuthBypassSafeForBuild({
        NODE_ENV: "production",
        VERCEL: "1",
        VERCEL_ENV: "production",
      })
    ).not.toThrow();
  });
});
