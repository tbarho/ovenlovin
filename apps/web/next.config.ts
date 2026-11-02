import type { NextConfig } from "next";
import path from "node:path";
import { CHROMIUM_BIN_INCLUDE } from "./src/lib/chromium-bin";
import { assertDemoModeSafeForBuild } from "./src/lib/demo/mode";
import { assertE2eAuthBypassSafeForBuild } from "./src/lib/e2e-auth";
import { PLAN_PATH_REDIRECTS } from "./src/lib/plan-path-redirects";

assertE2eAuthBypassSafeForBuild();
assertDemoModeSafeForBuild();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // pnpm nests packages behind symlinks; tracing from apps/web alone breaks
  // Vercel ("invalid deployment package" / symlinked directories) once Chromium
  // is in the tree. Root the NFT at the workspace so realpaths stay real.
  outputFileTracingRoot: path.join(__dirname, "../.."),
  // Only the prebuild copy: real files, no pnpm store or node_modules links.
  outputFileTracingIncludes: {
    "/api/cron/jobs-worker": [CHROMIUM_BIN_INCLUDE],
    "/api/v1/cookbooks/\\[id\\]/pdf": [CHROMIUM_BIN_INCLUDE],
    "/api/v1/cookbooks/*/pdf": [CHROMIUM_BIN_INCLUDE],
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
