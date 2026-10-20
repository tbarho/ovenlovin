/* eslint-disable no-undef */

/** Default vision-capable model on Vercel AI Gateway (Grok 4.7). */
export const DEFAULT_VISION_MODEL = "spacexai/grok-4.7";

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
 * Resolve the URL-import text extract model.
 * Override → `RK_MODEL_EXTRACT` → `RK_MODEL_DEFAULT` → grok-4.7 (same as paste).
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
export const IMPORT_GATEWAY_FALLBACK_MODELS = [
  "deepseek/deepseek-v4.1-flash",
  "openai/gpt-6-luna",
] as const;

/** AI SDK waits 2+4+… seconds per retry. 5 retries is 62s and blows the 60s import limit. */
export const IMPORT_GENERATE_MAX_RETRIES = 2;

/** Paste/URL generateObject budget. Photo keeps 55s. Leaves room for a 503 before the 60s platform 504. */
export const IMPORT_GENERATE_TIMEOUT_MS = 50_000;

export function remainingImportBudgetMs(startedAt: number, now = Date.now()): number {
  return Math.max(0, IMPORT_GENERATE_TIMEOUT_MS - (now - startedAt));
}

export function importGenerateOptions(primary?: string) {
  return {
    maxRetries: IMPORT_GENERATE_MAX_RETRIES,
    providerOptions: {
      gateway: {
        models: IMPORT_GATEWAY_FALLBACK_MODELS.filter((model) => model !== primary),
      },
    },
  };
}
