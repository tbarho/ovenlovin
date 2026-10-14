import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { publicOrigin } from "./public-origin";

const keys = ["NEXT_PUBLIC_APP_URL", "VERCEL_PROJECT_PRODUCTION_URL"] as const;

describe("publicOrigin", () => {
  const previous: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of keys) previous[key] = process.env[key];
  });

  afterEach(() => {
    for (const key of keys) {
      const value = previous[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("prefers NEXT_PUBLIC_APP_URL and strips a trailing slash", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://kitchen.example/";
    expect(publicOrigin()).toBe("https://kitchen.example");
  });

  it("uses the Vercel production host when APP_URL is unset", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "ovenlovin.vercel.app";
    expect(publicOrigin()).toBe("https://ovenlovin.vercel.app");
  });

  it("falls back to the production instance, never localhost", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    expect(publicOrigin()).toBe("https://ovenlovin.vercel.app");
    expect(publicOrigin()).not.toContain("localhost");
  });
});
