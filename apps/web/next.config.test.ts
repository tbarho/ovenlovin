import { existsSync, lstatSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import nextConfig from "./next.config";
import { copyChromiumBin, chromiumBinDest } from "./scripts/copy-chromium-bin";
import {
  CHROMIUM_BIN_INCLUDE,
  CHROMIUM_BIN_MARKER,
  findChromiumBinDir,
} from "./src/lib/chromium-bin";

function symlinkPaths(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) return [full];
    if (entry.isDirectory()) return symlinkPaths(full);
    return [];
  });
}

describe("Chromium file tracing", () => {
  const dest = copyChromiumBin();
  const marker = path.join(dest, CHROMIUM_BIN_MARKER);

  it("copies chromium.br as a real file with no symlinks", () => {
    expect(dest).toBe(chromiumBinDest());
    expect(existsSync(marker)).toBe(true);
    expect(lstatSync(marker).isFile()).toBe(true);
    expect(lstatSync(marker).isSymbolicLink()).toBe(false);
    expect(symlinkPaths(dest)).toEqual([]);
    expect(findChromiumBinDir(path.join(__dirname))).toBe(dest);
  });

  it("traces only the real copy on the worker and PDF routes", () => {
    const includes = Object.values(nextConfig.outputFileTracingIncludes ?? {}).flat();
    expect(includes.every((glob) => glob === CHROMIUM_BIN_INCLUDE)).toBe(true);
    expect(includes.some((glob) => glob.includes("node_modules"))).toBe(false);
    expect(includes.some((glob) => glob.includes(".pnpm"))).toBe(false);
    expect(nextConfig.outputFileTracingIncludes?.["/api/cron/jobs-worker"]).toEqual([
      CHROMIUM_BIN_INCLUDE,
    ]);
    expect(nextConfig.serverExternalPackages).toContain("@sparticuz/chromium");
    expect(nextConfig.serverExternalPackages).toContain("playwright-core");
  });
});
