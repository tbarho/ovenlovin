import { isDemoModeEnabled, type EnvLike } from "./mode";

const DEMO_ART = /^\/demo-kitchen\/[^/]+\.svg$/;

/**
 * The demo's dish images are flat SVG plate art, which made the demo book
 * read as a placeholder. In the demo the book leaves that art out, so recipe
 * openers and the cover are set in type like a real text cookbook.
 */
export function demoBookImages(images: string[], env: EnvLike = process.env) {
  if (!isDemoModeEnabled(env)) return images;
  return images.filter((image) => !DEMO_ART.test(image));
}
