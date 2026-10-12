import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@ovenlovin/core", "@ovenlovin/mcp"],
};

export default nextConfig;
