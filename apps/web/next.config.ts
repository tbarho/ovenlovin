import type { NextConfig } from "next";
import path from "node:path";
import { assertDemoModeSafeForBuild } from "./src/lib/demo/mode";
import { assertE2eAuthBypassSafeForBuild } from "./src/lib/e2e-auth";
import { PLAN_PATH_REDIRECTS } from "./src/lib/plan-path-redirects";

assertE2eAuthBypassSafeForBuild();
assertDemoModeSafeForBuild();

/**
 * Brotli binaries under bin/ are not JS, so NFT skips them unless listed.
 * Includes resolve from this app (apps/web). The pnpm store lives at the
 * workspace root; outputFileTracingRoot is that same root, so both globs
 * must be present. [id] is escaped so picomatch does not treat it as a class.
 */
const CHROMIUM_BIN = [
  "./node_modules/@sparticuz/chromium/bin/**",
  "../../node_modules/.pnpm/@sparticuz+chromium@*/node_modules/@sparticuz/chromium/bin/**",
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // pnpm nests packages behind symlinks; tracing from apps/web alone breaks
  // Vercel ("invalid deployment package" / symlinked directories) once Chromium
  // is in the tree. Root the NFT at the workspace so realpaths stay real.
  outputFileTracingRoot: path.join(__dirname, "../.."),
  outputFileTracingIncludes: {
    "/api/cron/jobs-worker": CHROMIUM_BIN,
    "/api/v1/cookbooks/\\[id\\]/pdf": CHROMIUM_BIN,
    "/api/v1/cookbooks/*/pdf": CHROMIUM_BIN,
  },
  serverExternalPackages: ["pdfjs-dist", "pdf-lib", "playwright-core", "@sparticuz/chromium"],
  async redirects() {
    return [...PLAN_PATH_REDIRECTS];
  },
  env: {
    // Inlined at build time. Empty Vercel overrides must not hide the stamp.
    NEXT_PUBLIC_BUILD_TIME: process.env.NEXT_PUBLIC_BUILD_TIME?.trim() || new Date().toISOString(),
  },
  transpilePackages: [
    "@ovenlovin/core",
    "@ovenlovin/mcp",
    "@ovenlovin/db",
    "@ovenlovin/allergens",
    "@ovenlovin/brand",
    "@ovenlovin/importers",
  ],
};

export default nextConfig;
