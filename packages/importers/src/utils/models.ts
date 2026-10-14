/* eslint-disable no-undef */

/** Default vision-capable model on Vercel AI Gateway (Grok 4.7). */
export const DEFAULT_VISION_MODEL = "spacexai/grok-4.7";

/**
 * Resolve the photo-import vision model.
 * Override → `RK_MODEL_VISION` → gateway default.
 */
export function resolveVisionModelId(
  override?: string,
  env: Record<string, string | undefined> = process.env
): string {
  const fromOverride = override?.trim();
  if (fromOverride) return fromOverride;
  const fromEnv = env.RK_MODEL_VISION?.trim();
  if (fromEnv) return fromEnv;
  return DEFAULT_VISION_MODEL;
}
