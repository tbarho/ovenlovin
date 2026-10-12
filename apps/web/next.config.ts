import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@ovenlovin/core", "@ovenlovin/mcp", "@ovenlovin/db", "@ovenlovin/allergens"],
};

export default nextConfig;
