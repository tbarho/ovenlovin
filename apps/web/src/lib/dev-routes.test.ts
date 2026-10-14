import { describe, expect, it } from "vitest";
import { isDevPreviewAllowed, isDevPreviewPath } from "./dev-routes";

describe("dev preview routes", () => {
  it("matches prototype and people-preview paths", () => {
    expect(isDevPreviewPath("/prototype")).toBe(true);
    expect(isDevPreviewPath("/prototype/people")).toBe(true);
    expect(isDevPreviewPath("/dev/people-preview")).toBe(true);
    expect(isDevPreviewPath("/dev/people-preview/recipe")).toBe(true);
    expect(isDevPreviewPath("/recipes")).toBe(false);
    expect(isDevPreviewPath("/docs")).toBe(false);
  });

  it("is allowed on preview, local, and CI — never on Vercel production", () => {
    expect(isDevPreviewAllowed({ NODE_ENV: "development" })).toBe(true);
    expect(isDevPreviewAllowed({ NODE_ENV: "test" })).toBe(true);
    expect(isDevPreviewAllowed({ VERCEL_ENV: "preview", VERCEL: "1" })).toBe(true);
    expect(isDevPreviewAllowed({ VERCEL_ENV: "production", NODE_ENV: "production" })).toBe(false);
  });
});
