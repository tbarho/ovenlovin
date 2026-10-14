import { describe, expect, it, vi } from "vitest";
import {
  VERCEL_DASHBOARD_URL,
  describeDeploy,
  describeDeployResolved,
  formatDeployedAt,
  hostFromOrigin,
  resolveVercelDashboardScope,
} from "./deploy";

const productionEnv = {
  VERCEL: "1",
  VERCEL_ENV: "production",
  VERCEL_PROJECT_PRODUCTION_URL: "ovenlovin.vercel.app",
  VERCEL_URL: "ovenlovin-git-main.vercel.app",
  VERCEL_DEPLOYMENT_ID: "dpl_abc123",
  VERCEL_ORG_ID: "team_nLlpyC6REAqxydlFKbrMDlud",
  VERCEL_PROJECT_ID: "prj_12HKQaOmR5t7Cy6T9Vxw3",
  VERCEL_GIT_REPO_OWNER: "tbarho",
  VERCEL_GIT_REPO_SLUG: "ovenlovin",
  VERCEL_GIT_COMMIT_SHA: "621312fabcdef0123456789",
  VERCEL_GIT_COMMIT_REF: "main",
  VERCEL_GIT_COMMIT_MESSAGE: "feat(web): show People/Recipes nav",
  NEXT_PUBLIC_BUILD_TIME: "2026-10-13T18:00:00.000Z",
};

function jsonResponse(body: unknown, ok = true): Response {
  return {
    ok,
    json: async () => body,
  } as Response;
}

describe("describeDeploy", () => {
  it("uses OVENLOVIN_VERCEL_* slug overrides, never the git owner", () => {
    const deploy = describeDeploy(
      {
        ...productionEnv,
        OVENLOVIN_VERCEL_TEAM_SLUG: "ty-barho",
        OVENLOVIN_VERCEL_PROJECT_SLUG: "ovenlovin",
      },
      { origin: "https://ovenlovin.vercel.app" }
    );

    expect(deploy.live).toBe(true);
    expect(deploy.environment).toBe("production");
    expect(deploy.headline).toBe("You're live.");
    expect(deploy.instanceUrl).toBe("https://ovenlovin.vercel.app");
    expect(deploy.instanceHost).toBe("ovenlovin.vercel.app");
    expect(deploy.deployedAt).toBe("2026-10-13T18:00:00.000Z");
    expect(deploy.vercel.projectUrl).toBe("https://vercel.com/ty-barho/ovenlovin");
    expect(deploy.vercel.deploymentUrl).toBe("https://vercel.com/ty-barho/ovenlovin/dpl_abc123");
    expect(deploy.github.repoUrl).toBe("https://github.com/tbarho/ovenlovin");
    expect(deploy.github.commitUrl).toBe(
      "https://github.com/tbarho/ovenlovin/commit/621312fabcdef0123456789"
    );
    expect(deploy.github.commitShort).toBe("621312f");
  });

  it("uses the git repo slug as the project name when only the team slug is overridden", () => {
    const deploy = describeDeploy({
      ...productionEnv,
      OVENLOVIN_VERCEL_TEAM_SLUG: "ty-barho",
    });

    expect(deploy.vercel.projectUrl).toBe("https://vercel.com/ty-barho/ovenlovin");
    expect(deploy.vercel.deploymentUrl).toBe("https://vercel.com/ty-barho/ovenlovin/dpl_abc123");
  });

  it("falls back to the Vercel dashboard instead of the git owner or raw ids", () => {
    const deploy = describeDeploy({
      VERCEL_ENV: "preview",
      VERCEL_URL: "ovenlovin-git-feat.vercel.app",
      VERCEL_DEPLOYMENT_ID: "dpl_preview",
      VERCEL_ORG_ID: "team_ty",
      VERCEL_PROJECT_ID: "prj_oven",
      VERCEL_GIT_REPO_OWNER: "tbarho",
      VERCEL_GIT_REPO_SLUG: "ovenlovin",
    });

    expect(deploy.live).toBe(true);
    expect(deploy.environmentLabel).toBe("Preview");
    expect(deploy.vercel.projectUrl).toBe(VERCEL_DASHBOARD_URL);
    expect(deploy.vercel.deploymentUrl).toBeNull();
    expect(deploy.vercel.projectUrl).not.toContain("tbarho");
    expect(deploy.vercel.projectUrl).not.toContain("team_ty");
    expect(deploy.github.repoUrl).toBe("https://github.com/tbarho/ovenlovin");
  });

  it("describes a local instance without inventing Vercel or GitHub links", () => {
    const deploy = describeDeploy({}, { origin: "http://localhost:3000" });
    expect(deploy.live).toBe(false);
    expect(deploy.environment).toBe("local");
    expect(deploy.headline).toBe("Running locally.");
    expect(deploy.instanceHost).toBe("localhost:3000");
    expect(deploy.vercel.projectUrl).toBeNull();
    expect(deploy.vercel.deploymentUrl).toBeNull();
    expect(deploy.github.repoUrl).toBeNull();
  });
});

describe("resolveVercelDashboardScope", () => {
  it("returns override slugs without calling the Vercel API", async () => {
    const fetchMock = vi.fn();
    const scope = await resolveVercelDashboardScope(
      {
        ...productionEnv,
        OVENLOVIN_VERCEL_TEAM_SLUG: "ty-barho",
        VERCEL_TOKEN: "secret",
      },
      { fetch: fetchMock, cache: new Map() }
    );

    expect(scope).toEqual({ teamSlug: "ty-barho", projectSlug: "ovenlovin" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("resolves team and project slugs from the Vercel API and caches the result", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/v9/projects/")) {
        return jsonResponse({
          name: "ovenlovin",
          accountId: "team_nLlpyC6REAqxydlFKbrMDlud",
        });
      }
      if (url.includes("/v2/teams/")) {
        return jsonResponse({ slug: "ty-barho" });
      }
      return jsonResponse({}, false);
    });
    const cache = new Map();
    const env = { ...productionEnv, VERCEL_TOKEN: "secret" };

    const first = await resolveVercelDashboardScope(env, { fetch: fetchMock, cache });
    const second = await resolveVercelDashboardScope(env, { fetch: fetchMock, cache });

    expect(first).toEqual({ teamSlug: "ty-barho", projectSlug: "ovenlovin" });
    expect(second).toEqual(first);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      "/v9/projects/prj_12HKQaOmR5t7Cy6T9Vxw3"
    );
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain(
      "/v2/teams/team_nLlpyC6REAqxydlFKbrMDlud"
    );
  });

  it("uses the personal account username when the team lookup fails", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/v9/projects/")) {
        return jsonResponse({ name: "ovenlovin", accountId: "usr_123" });
      }
      if (url.includes("/v2/teams/")) {
        return jsonResponse({}, false);
      }
      if (url.includes("/v2/user")) {
        return jsonResponse({ user: { username: "ty-barho" } });
      }
      return jsonResponse({}, false);
    });

    const scope = await resolveVercelDashboardScope(
      { ...productionEnv, OVENLOVIN_VERCEL_TOKEN: "secret" },
      { fetch: fetchMock, cache: new Map() }
    );

    expect(scope).toEqual({ teamSlug: "ty-barho", projectSlug: "ovenlovin" });
  });

  it("returns null when no override or token is available", async () => {
    const fetchMock = vi.fn();
    await expect(
      resolveVercelDashboardScope(productionEnv, { fetch: fetchMock, cache: new Map() })
    ).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("describeDeployResolved", () => {
  it("emits ty-barho dashboard links from a resolved API scope", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/v9/projects/")) {
        return jsonResponse({ name: "ovenlovin", accountId: "team_abc" });
      }
      if (url.includes("/v2/teams/")) {
        return jsonResponse({ slug: "ty-barho" });
      }
      return jsonResponse({}, false);
    });

    const deploy = await describeDeployResolved(
      { ...productionEnv, VERCEL_TOKEN: "secret" },
      { origin: "https://ovenlovin.vercel.app", fetch: fetchMock, cache: new Map() }
    );

    expect(deploy.vercel.projectUrl).toBe("https://vercel.com/ty-barho/ovenlovin");
    expect(deploy.vercel.deploymentUrl).toBe("https://vercel.com/ty-barho/ovenlovin/dpl_abc123");
  });

  it("falls back to the Vercel dashboard when lookup cannot complete", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({}, false));
    const deploy = await describeDeployResolved(
      { ...productionEnv, VERCEL_TOKEN: "secret" },
      { fetch: fetchMock, cache: new Map() }
    );

    expect(deploy.vercel.projectUrl).toBe(VERCEL_DASHBOARD_URL);
    expect(deploy.vercel.deploymentUrl).toBeNull();
    expect(deploy.vercel.projectUrl).not.toContain("tbarho");
  });
});

describe("formatDeployedAt", () => {
  it("formats an absolute UTC stamp and a relative phrase", () => {
    const display = formatDeployedAt(
      "2026-10-13T16:00:00.000Z",
      new Date("2026-10-13T18:20:00.000Z")
    );
    expect(display.absolute).toMatch(/Oct 13, 2026/);
    expect(display.absolute).toMatch(/UTC/);
    expect(display.relative).toMatch(/hour/);
  });

  it("says just now for a fresh deploy", () => {
    const now = new Date("2026-10-13T18:00:10.000Z");
    expect(formatDeployedAt("2026-10-13T18:00:00.000Z", now).relative).toBe("just now");
  });
});

describe("hostFromOrigin", () => {
  it("strips the scheme", () => {
    expect(hostFromOrigin("https://ovenlovin.vercel.app/")).toBe("ovenlovin.vercel.app");
  });
});
