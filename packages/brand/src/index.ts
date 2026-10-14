export const BRAND_NAME = "OvenLovin";

/** Playful display face for the single-word wordmark. Body text stays Geist. */
export const BRAND_DISPLAY_FONT = "Fascinate Inline";

export const brandAssets = {
  mark: "mark.png",
  markDark: "mark.png",
  wordmark: "wordmark.png",
  wordmarkDark: "wordmark-dark.png",
  lockup: "lockup.png",
  favicon: "favicon.svg",
  favicon32: "favicon-32.png",
  appleTouch: "apple-touch-icon.png",
  og: "og.png",
  ogDark: "og-dark.png",
} as const;

export const brandPublicPath = {
  mark: "/brand/mark.png",
  markDark: "/brand/mark.png",
  wordmark: "/brand/wordmark.png",
  wordmarkDark: "/brand/wordmark-dark.png",
  lockup: "/brand/lockup.png",
  favicon: "/brand/favicon.svg",
  favicon32: "/brand/favicon-32.png",
  appleTouch: "/brand/apple-touch-icon.png",
  og: "/brand/og.png",
  ogDark: "/brand/og-dark.png",
} as const;

export type BrandAssetName = keyof typeof brandAssets;

export { VERCEL_DEPLOY_URL } from "./deploy";
export {
  DOCS_SHARE_ORIGIN,
  absoluteShareUrl,
  appShareOrigin,
  appShareUrl,
  docsShareUrl,
} from "./share";
