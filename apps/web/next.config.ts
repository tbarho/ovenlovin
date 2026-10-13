import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_BUILD_TIME: process.env.NEXT_PUBLIC_BUILD_TIME ?? new Date().toISOString(),
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
