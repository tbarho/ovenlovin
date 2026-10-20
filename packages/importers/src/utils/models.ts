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

/** Gateway fallbacks when the primary model returns a fast 503. */
export const IMPORT_GATEWAY_FALLBACK_MODELS = ["spacexai/grok-4.6", "openai/gpt-4o-mini"] as const;

/** Default AI SDK retries are 2 (3 attempts). Stay inside the 60s / 55s photo budget. */
export const IMPORT_GENERATE_MAX_RETRIES = 5;

export function importGenerateOptions() {
  return {
    maxRetries: IMPORT_GENERATE_MAX_RETRIES,
    providerOptions: {
      gateway: { models: [...IMPORT_GATEWAY_FALLBACK_MODELS] },
    },
  };
}
