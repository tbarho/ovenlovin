/* eslint-disable no-undef, @typescript-eslint/no-explicit-any */
import { generateObject } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { isImportAiUnavailable, tagImportAiTimeout } from "@ovenlovin/core/import-ai-unavailable";

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

/**
 * Third-party DeepSeek hosts ignore responseFormat/schema. Pin only the DeepSeek
 * call - gateway `only` applies to every model in that request.
 */
export const DEEPSEEK_GATEWAY_PROVIDERS = ["deepseek"] as const;

/** AI SDK waits 2+4+… seconds per retry. 5 retries is 62s and blows the 60s import limit. */
export const IMPORT_GENERATE_MAX_RETRIES = 2;

/** Paste/URL generateObject budget. Photo keeps 55s. Leaves room for a 503 before the 60s platform 504. */
export const IMPORT_GENERATE_TIMEOUT_MS = 50_000;

export function remainingImportBudgetMs(startedAt: number, now = Date.now()): number {
  return Math.max(0, IMPORT_GENERATE_TIMEOUT_MS - (now - startedAt));
}

export function importGenerateOptions(primary?: string) {
  const id = primary ?? DEFAULT_EXTRACT_MODEL;
  if (id.startsWith("deepseek/")) {
    return {
      maxRetries: IMPORT_GENERATE_MAX_RETRIES,
      providerOptions: { gateway: { only: [...DEEPSEEK_GATEWAY_PROVIDERS] } },
    };
  }
  return {
    maxRetries: IMPORT_GENERATE_MAX_RETRIES,
    providerOptions: {
      gateway: {
        models: IMPORT_GATEWAY_FALLBACK_MODELS.filter((model) => model !== id),
      },
    },
  };
}

function isDeepSeekPrimary(modelId: string): boolean {
  return modelId.startsWith("deepseek/");
}

/** DeepSeek is pinned on its own call; Luna/grok run without that `only` filter. */
export async function generateImportObject(
  generate: typeof generateObject,
  modelId: string,
  options: Record<string, any>
): Promise<any> {
  const call = (id: string) =>
    generate({
      model: gateway(id) as any,
      ...options,
      ...importGenerateOptions(id),
    } as any);
  try {
    return await call(modelId);
  } catch (error) {
    const tagged = tagImportAiTimeout(error);
    const next = IMPORT_GATEWAY_FALLBACK_MODELS.find((model) => model !== modelId);
    if (
      !isDeepSeekPrimary(modelId) ||
      !next ||
      !isImportAiUnavailable(tagged) ||
      (tagged instanceof Error && (tagged as { importAiTimeout?: boolean }).importAiTimeout)
    ) {
      throw tagged;
    }
    return await call(next);
  }
}
