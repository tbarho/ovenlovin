import { describe, expect, it } from "vitest";
import { describeDeploy, formatDeployedAt, hostFromOrigin } from "./deploy";

describe("describeDeploy", () => {
  it("builds Vercel dashboard, deployment, and GitHub links from system env", () => {
    const deploy = describeDeploy(
      {
        VERCEL: "1",
        VERCEL_ENV: "production",
        VERCEL_PROJECT_PRODUCTION_URL: "ovenlovin.vercel.app",
        VERCEL_URL: "ovenlovin-git-main.vercel.app",
        VERCEL_DEPLOYMENT_ID: "dpl_abc123",
        VERCEL_ORG_ID: "team_ty",
        VERCEL_PROJECT_ID: "prj_oven",
        VERCEL_GIT_REPO_OWNER: "tbarho",
        VERCEL_GIT_REPO_SLUG: "ovenlovin",
        VERCEL_GIT_COMMIT_SHA: "621312fabcdef0123456789",
        VERCEL_GIT_COMMIT_REF: "main",
        VERCEL_GIT_COMMIT_MESSAGE: "feat(web): show People/Recipes nav",
        NEXT_PUBLIC_BUILD_TIME: "2026-10-13T18:00:00.000Z",
      },
      { origin: "https://ovenlovin.vercel.app" }
    );

    expect(deploy.live).toBe(true);
    expect(deploy.environment).toBe("production");
    expect(deploy.headline).toBe("You're live.");
    expect(deploy.instanceUrl).toBe("https://ovenlovin.vercel.app");
    expect(deploy.instanceHost).toBe("ovenlovin.vercel.app");
    expect(deploy.deployedAt).toBe("2026-10-13T18:00:00.000Z");
    expect(deploy.vercel.projectUrl).toBe("https://vercel.com/team_ty/prj_oven");
    expect(deploy.vercel.deploymentUrl).toBe("https://vercel.com/team_ty/prj_oven/dpl_abc123");
    expect(deploy.github.repoUrl).toBe("https://github.com/tbarho/ovenlovin");
    expect(deploy.github.commitUrl).toBe(
      "https://github.com/tbarho/ovenlovin/commit/621312fabcdef0123456789"
    );
    expect(deploy.github.commitShort).toBe("621312f");
  });

  it("falls back to git owner/slug for the Vercel project when org ids are missing", () => {
    const deploy = describeDeploy({
      VERCEL_ENV: "preview",
      VERCEL_URL: "ovenlovin-git-feat.vercel.app",
      VERCEL_GIT_REPO_OWNER: "tbarho",
      VERCEL_GIT_REPO_SLUG: "ovenlovin",
    });

    expect(deploy.live).toBe(true);
    expect(deploy.environmentLabel).toBe("Preview");
    expect(deploy.vercel.projectUrl).toBe("https://vercel.com/tbarho/ovenlovin");
    expect(deploy.vercel.deploymentUrl).toBe("https://ovenlovin-git-feat.vercel.app");
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
