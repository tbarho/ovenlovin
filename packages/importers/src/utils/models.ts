/* eslint-disable no-undef */

/** Default vision-capable model on Vercel AI Gateway (Grok 4.7). */
export const DEFAULT_VISION_MODEL = "spacexai/grok-4.7";

/**
 * Low-cost fast text model on Vercel AI Gateway for unstructured recipe pages.
 * Catalog: openai/gpt-4o-mini ($0.15 / $0.60 per 1M tokens, structured output).
 */
export const DEFAULT_EXTRACT_MODEL = "openai/gpt-4o-mini";

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

/**
 * Resolve the URL-import text extract model.
 * Override → `RK_MODEL_EXTRACT` → cheap gateway default (not RK_MODEL_DEFAULT).
 */
export function resolveExtractModelId(
  override?: string,
  env: Record<string, string | undefined> = process.env
): string {
  const fromOverride = override?.trim();
  if (fromOverride) return fromOverride;
  const fromEnv = env.RK_MODEL_EXTRACT?.trim();
  if (fromEnv) return fromEnv;
  return DEFAULT_EXTRACT_MODEL;
}
