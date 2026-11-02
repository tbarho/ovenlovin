import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import nextConfig from "./next.config";

const appRoot = __dirname;
const workspaceRoot = path.join(appRoot, "../..");

describe("Chromium file tracing", () => {
  const includes = nextConfig.outputFileTracingIncludes ?? {};

  it("includes bin globs on the worker and PDF routes", () => {
    const worker = includes["/api/cron/jobs-worker"] ?? [];
    const pdf =
      includes["/api/v1/cookbooks/\\[id\\]/pdf"] ?? includes["/api/v1/cookbooks/*/pdf"] ?? [];
    expect(worker.some((glob) => glob.includes("@sparticuz/chromium/bin"))).toBe(true);
    expect(pdf.some((glob) => glob.includes("@sparticuz/chromium/bin"))).toBe(true);
    expect(nextConfig.serverExternalPackages).toContain("@sparticuz/chromium");
    expect(nextConfig.serverExternalPackages).toContain("playwright-core");
  });

  it("resolves the pnpm Chromium bin that Vercel looks up", () => {
    const viaLink = path.join(appRoot, "node_modules/@sparticuz/chromium/bin/chromium.br");
    const pnpmDir = path.join(workspaceRoot, "node_modules/.pnpm");
    const store = readdirSync(pnpmDir).find((name) => name.startsWith("@sparticuz+chromium@"));
    const viaPnpm = store
      ? path.join(pnpmDir, store, "node_modules/@sparticuz/chromium/bin/chromium.br")
      : "";
    expect(existsSync(viaLink)).toBe(true);
    expect(store).toBeTruthy();
    expect(existsSync(viaPnpm)).toBe(true);
  });
});
