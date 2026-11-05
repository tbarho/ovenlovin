import { describe, expect, it } from "vitest";
import { cronAuthorized, cronHeaders, cronSecretRequired } from "./cron-auth";

const request = (headers: Record<string, string> = {}) =>
  new Request("https://preview.example/api/cron/jobs-worker", { method: "POST", headers });

describe("cronSecretRequired", () => {
  it("requires a secret on Vercel production, not preview", () => {
    expect(cronSecretRequired({ VERCEL_ENV: "production", NODE_ENV: "production" })).toBe(true);
    expect(cronSecretRequired({ VERCEL_ENV: "preview", NODE_ENV: "production" })).toBe(false);
    expect(cronSecretRequired({ VERCEL_ENV: "development", NODE_ENV: "production" })).toBe(false);
  });

  it("falls back to NODE_ENV when VERCEL_ENV is unset", () => {
    expect(cronSecretRequired({ NODE_ENV: "production" })).toBe(true);
    expect(cronSecretRequired({ NODE_ENV: "development" })).toBe(false);
    expect(cronSecretRequired({ NODE_ENV: "test" })).toBe(false);
  });
});

describe("cronAuthorized", () => {
  it("accepts the matching bearer when CRON_SECRET is set", () => {
    const env = { CRON_SECRET: "shh", VERCEL_ENV: "production", NODE_ENV: "production" };
    expect(cronAuthorized(request({ authorization: "Bearer shh" }), env)).toBe(true);
    expect(cronAuthorized(request({ authorization: "Bearer other" }), env)).toBe(false);
    expect(cronAuthorized(request(), env)).toBe(false);
  });

  it("allows an unauthenticated kick on Vercel preview when CRON_SECRET is unset", () => {
    const env = { VERCEL_ENV: "preview", NODE_ENV: "production" };
    expect(cronAuthorized(request(), env)).toBe(true);
  });

  it("rejects an unauthenticated kick on Vercel production when CRON_SECRET is unset", () => {
    const env = { VERCEL_ENV: "production", NODE_ENV: "production" };
    expect(cronAuthorized(request(), env)).toBe(false);
  });

  it("still requires the bearer on preview when CRON_SECRET is set", () => {
    const env = { CRON_SECRET: "shh", VERCEL_ENV: "preview", NODE_ENV: "production" };
    expect(cronAuthorized(request(), env)).toBe(false);
    expect(cronAuthorized(request({ authorization: "Bearer shh" }), env)).toBe(true);
  });
});

describe("cronHeaders", () => {
  it("sends the bearer only when CRON_SECRET is set", () => {
    expect(cronHeaders({ CRON_SECRET: "shh" })).toEqual({ authorization: "Bearer shh" });
    expect(cronHeaders({ VERCEL_ENV: "preview", NODE_ENV: "production" })).toEqual({});
  });
});
