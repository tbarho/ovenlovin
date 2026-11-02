import { describe, expect, it } from "vitest";
import { cronAuthorized } from "./cron-auth";
import { isBooksEnabled, workerKickRequest } from "./jobs";

describe("isBooksEnabled", () => {
  it("is off unless OVENLOVIN_BOOKS is set", () => {
    expect(isBooksEnabled({})).toBe(false);
    expect(isBooksEnabled({ OVENLOVIN_BOOKS: "0" })).toBe(false);
    expect(isBooksEnabled({ OVENLOVIN_BOOKS: "1" })).toBe(true);
    expect(isBooksEnabled({ OVENLOVIN_BOOKS: "true" })).toBe(true);
  });
});

describe("workerKickRequest", () => {
  const origin = "https://ovenlovin-git-print.vercel.app";

  it("sends the cron bearer and protection bypass on header and query", () => {
    const kick = workerKickRequest(origin, {
      CRON_SECRET: "shh",
      VERCEL_AUTOMATION_BYPASS_SECRET: "bypass",
    });
    expect(kick.url).toBe(`${origin}/api/cron/jobs-worker?x-vercel-protection-bypass=bypass`);
    expect(kick.headers).toEqual({
      authorization: "Bearer shh",
      "x-vercel-protection-bypass": "bypass",
      "x-vercel-set-bypass-cookie": "true",
    });
  });

  it("omits auth and bypass on a preview with neither secret", () => {
    const kick = workerKickRequest(origin, {
      VERCEL_ENV: "preview",
      NODE_ENV: "production",
    });
    expect(kick.url).toBe(`${origin}/api/cron/jobs-worker`);
    expect(kick.headers).toEqual({});
  });

  it("is accepted by cronAuthorized on preview and production", () => {
    const previewEnv = { VERCEL_ENV: "preview", NODE_ENV: "production" };
    const productionEnv = {
      CRON_SECRET: "shh",
      VERCEL_ENV: "production",
      NODE_ENV: "production",
    };
    const incoming = (env: Record<string, string>) =>
      new Request(workerKickRequest(origin, env).url, {
        method: "POST",
        headers: workerKickRequest(origin, env).headers,
      });
    expect(cronAuthorized(incoming(previewEnv), previewEnv)).toBe(true);
    expect(cronAuthorized(incoming(productionEnv), productionEnv)).toBe(true);
  });
});
