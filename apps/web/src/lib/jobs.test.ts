import { afterEach, describe, expect, it, vi } from "vitest";
import { cronAuthorized } from "./cron-auth";
import {
  isBooksEnabled,
  kickWorkerHttp,
  readKickResponse,
  workerKickOrigin,
  workerKickRequest,
} from "./jobs";

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

  it("kicks VERCEL_URL with the bypass query on every hop", () => {
    const kick = workerKickRequest(origin, {
      VERCEL_URL: "ovenlovin-dpl.vercel.app",
      VERCEL_AUTOMATION_BYPASS_SECRET: "bypass",
    });
    expect(kick.url).toBe(
      "https://ovenlovin-dpl.vercel.app/api/cron/jobs-worker?x-vercel-protection-bypass=bypass"
    );
    expect(workerKickOrigin(origin, { VERCEL_URL: "https://ovenlovin-dpl.vercel.app" })).toBe(
      "https://ovenlovin-dpl.vercel.app"
    );
  });

  it("forwards the incoming SSO cookie when the bypass secret is missing", () => {
    const kick = workerKickRequest(
      origin,
      { VERCEL_ENV: "preview", NODE_ENV: "production" },
      "_vercel_jwt=preview-sso"
    );
    expect(kick.url).toBe(`${origin}/api/cron/jobs-worker`);
    expect(kick.headers).toEqual({ cookie: "_vercel_jwt=preview-sso" });
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

describe("readKickResponse", () => {
  it("treats 2xx as success and 307/401 as a blocked hop", () => {
    expect(readKickResponse(new Response(null, { status: 202 }))).toEqual({
      ok: true,
      redirected: false,
      status: 202,
      location: null,
    });
    expect(
      readKickResponse(new Response(null, { status: 307, headers: { location: "/" } }))
    ).toEqual({
      ok: false,
      redirected: true,
      status: 307,
      location: "/",
    });
    expect(readKickResponse(new Response(null, { status: 401 }))).toEqual({
      ok: false,
      redirected: false,
      status: 401,
      location: null,
    });
  });
});

describe("kickWorkerHttp", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not follow protection redirects", async () => {
    const fetchMock = vi.fn(
      async () => new Response(null, { status: 307, headers: { location: "/" } })
    );
    vi.stubGlobal("fetch", fetchMock);
    const result = await kickWorkerHttp("https://ovenlovin-git-print.vercel.app", {
      VERCEL_ENV: "preview",
      NODE_ENV: "production",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://ovenlovin-git-print.vercel.app/api/cron/jobs-worker",
      expect.objectContaining({ method: "POST", redirect: "manual" })
    );
    expect(result).toEqual({ ok: false, redirected: true, status: 307, location: "/" });
  });
});
