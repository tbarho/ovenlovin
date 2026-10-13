export const BRAND_NAME = "OvenLovin";

export const brandAssets = {
  mark: "mark.png",
  markDark: "mark.png",
  wordmark: "wordmark.svg",
  wordmarkDark: "wordmark-dark.svg",
  favicon: "favicon.svg",
  favicon32: "favicon-32.png",
  appleTouch: "apple-touch-icon.png",
  og: "og.png",
  ogDark: "og-dark.png",
} as const;

export const brandPublicPath = {
  mark: "/brand/mark.png",
  markDark: "/brand/mark.png",
  wordmark: "/brand/wordmark.svg",
  wordmarkDark: "/brand/wordmark-dark.svg",
  favicon: "/brand/favicon.svg",
  favicon32: "/brand/favicon-32.png",
  appleTouch: "/brand/apple-touch-icon.png",
  og: "/brand/og.png",
  ogDark: "/brand/og-dark.png",
} as const;

export type BrandAssetName = keyof typeof brandAssets;

export { VERCEL_DEPLOY_URL } from "./deploy";
