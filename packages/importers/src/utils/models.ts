/* eslint-disable no-undef */

/** Default vision-capable model on Vercel AI Gateway (DeepSeek 4.1 Flash). */
export const DEFAULT_VISION_MODEL = "deepseek/deepseek-v4.1-flash";

/** Same primary as paste and photo import. */
export const DEFAULT_EXTRACT_MODEL = DEFAULT_VISION_MODEL;

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
 * Resolve the paste-import text model.
 * Override → `RK_MODEL_DEFAULT` → DeepSeek 4.1 Flash.
 */
export function resolveDefaultModelId(
  override?: string,
  env: Record<string, string | undefined> = process.env
): string {
  const fromOverride = override?.trim();
  if (fromOverride) return fromOverride;
  const fromDefault = env.RK_MODEL_DEFAULT?.trim();
  if (fromDefault) return fromDefault;
  return DEFAULT_VISION_MODEL;
}

/**
 * Resolve the URL-import text extract model.
 * Override → `RK_MODEL_EXTRACT` → `RK_MODEL_DEFAULT` → DeepSeek 4.1 Flash.
 */
export function resolveExtractModelId(
  override?: string,
  env: Record<string, string | undefined> = process.env
): string {
  const fromOverride = override?.trim();
  if (fromOverride) return fromOverride;
  const fromExtract = env.RK_MODEL_EXTRACT?.trim();
  if (fromExtract) return fromExtract;
  const fromDefault = env.RK_MODEL_DEFAULT?.trim();
  if (fromDefault) return fromDefault;
  return DEFAULT_EXTRACT_MODEL;
}

/** Gateway fallbacks when the primary model returns a fast 503. */
export const IMPORT_GATEWAY_FALLBACK_MODELS = ["openai/gpt-6-luna", "spacexai/grok-4.7"] as const;

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
