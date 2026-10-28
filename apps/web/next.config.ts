import type { NextConfig } from "next";
import { assertDemoModeSafeForBuild } from "./src/lib/demo/mode";
import { assertE2eAuthBypassSafeForBuild } from "./src/lib/e2e-auth";
import { PLAN_PATH_REDIRECTS } from "./src/lib/plan-path-redirects";

assertE2eAuthBypassSafeForBuild();
assertDemoModeSafeForBuild();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["pdfjs-dist", "pdf-lib", "playwright-core", "@sparticuz/chromium"],
  // The serverless Chromium binary is read from disk at runtime, so tracing cannot see it.
  outputFileTracingIncludes: {
    "/api/cron/jobs-worker": [
      "../../node_modules/@sparticuz/chromium/bin/**",
      "../../node_modules/.pnpm/@sparticuz+chromium@*/node_modules/@sparticuz/chromium/bin/**",
      "./node_modules/@sparticuz/chromium/bin/**",
    ],
  },
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
