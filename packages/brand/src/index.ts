export const BRAND_NAME = "OvenLovin";

export const brandAssets = {
  mark: "mark.svg",
  markDark: "mark-dark.svg",
  wordmark: "wordmark.svg",
  wordmarkDark: "wordmark-dark.svg",
  logo: "logo.svg",
  logoDark: "logo-dark.svg",
  favicon: "favicon.svg",
} as const;

export const brandPublicPath = {
  mark: "/brand/mark.svg",
  markDark: "/brand/mark-dark.svg",
  wordmark: "/brand/wordmark.svg",
  wordmarkDark: "/brand/wordmark-dark.svg",
  logo: "/brand/logo.svg",
  logoDark: "/brand/logo-dark.svg",
  favicon: "/brand/favicon.svg",
} as const;

export type BrandAssetName = keyof typeof brandAssets;

export { VERCEL_DEPLOY_URL } from "./deploy";
