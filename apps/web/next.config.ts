import type { NextConfig } from "next";
import { assertDemoModeSafeForBuild } from "./src/lib/demo/mode";
import { assertE2eAuthBypassSafeForBuild } from "./src/lib/e2e-auth";

assertE2eAuthBypassSafeForBuild();
assertDemoModeSafeForBuild();

const nextConfig: NextConfig = {
  reactStrictMode: true,
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
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],
  outputFileTracingIncludes: {
    "/api/v1/recipes/import": ["./node_modules/@sparticuz/chromium/bin/**"],
    "/mcp": ["./node_modules/@sparticuz/chromium/bin/**"],
  },
};

export default nextConfig;
