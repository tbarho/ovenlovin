import { describe, expect, it } from "vitest";
import {
  DEFAULT_EXTRACT_MODEL,
  DEFAULT_VISION_MODEL,
  IMPORT_GATEWAY_FALLBACK_MODELS,
  IMPORT_GENERATE_MAX_RETRIES,
  IMPORT_GENERATE_TIMEOUT_MS,
  importGenerateOptions,
  remainingImportBudgetMs,
  resolveExtractModelId,
  resolveVisionModelId,
} from "./models";

describe("resolveVisionModelId", () => {
  it("uses the explicit override first", () => {
    expect(
      resolveVisionModelId("openai/gpt-4o", { RK_MODEL_VISION: "google/gemini-2.5-flash" })
    ).toBe("openai/gpt-4o");
  });

  it("falls back to RK_MODEL_VISION", () => {
    expect(resolveVisionModelId(undefined, { RK_MODEL_VISION: "google/gemini-2.5-flash" })).toBe(
      "google/gemini-2.5-flash"
    );
  });

  it("uses the gateway default when nothing is set", () => {
    expect(resolveVisionModelId(undefined, {})).toBe(DEFAULT_VISION_MODEL);
    expect(DEFAULT_VISION_MODEL).toBe("spacexai/grok-4.7");
  });

  it("ignores blank override and env values", () => {
    expect(resolveVisionModelId("  ", { RK_MODEL_VISION: "   " })).toBe(DEFAULT_VISION_MODEL);
  });
});

describe("resolveExtractModelId", () => {
  it("uses the same grok-4.7 primary as paste when nothing is set", () => {
    expect(resolveExtractModelId(undefined, {})).toBe(DEFAULT_VISION_MODEL);
    expect(DEFAULT_EXTRACT_MODEL).toBe("spacexai/grok-4.7");
  });

  it("uses RK_MODEL_DEFAULT when RK_MODEL_EXTRACT is unset", () => {
    expect(resolveExtractModelId(undefined, { RK_MODEL_DEFAULT: "google/gemini-2.5-flash" })).toBe(
      "google/gemini-2.5-flash"
    );
  });

  it("uses RK_MODEL_EXTRACT when set", () => {
    expect(
      resolveExtractModelId(undefined, {
        RK_MODEL_EXTRACT: "google/gemini-2.5-flash",
        RK_MODEL_DEFAULT: "spacexai/grok-4.7",
      })
    ).toBe("google/gemini-2.5-flash");
  });

  it("uses the explicit override first", () => {
    expect(
      resolveExtractModelId("openai/gpt-6-luna", { RK_MODEL_EXTRACT: "google/gemini-2.5-flash" })
    ).toBe("openai/gpt-6-luna");
  });
});

/** Same exponential wait the AI SDK uses for maxRetries (2s, 4s, 8s, …). */
function aiSdkRetryWaitMs(maxRetries: number): number {
  return Array.from({ length: maxRetries }, (_, i) => 2 ** (i + 1) * 1000).reduce(
    (a, b) => a + b,
    0
  );
}

describe("importGenerateOptions", () => {
  it("keeps the retry wait inside the 60s import route limit", () => {
    expect(aiSdkRetryWaitMs(5)).toBeGreaterThan(60_000);
    expect(aiSdkRetryWaitMs(IMPORT_GENERATE_MAX_RETRIES)).toBeLessThan(60_000);
    expect(IMPORT_GENERATE_MAX_RETRIES).toBeLessThanOrEqual(3);
    expect(IMPORT_GENERATE_TIMEOUT_MS).toBe(50_000);
    expect(IMPORT_GENERATE_TIMEOUT_MS).toBeLessThan(60_000);
    expect(importGenerateOptions()).toEqual({
      maxRetries: IMPORT_GENERATE_MAX_RETRIES,
      providerOptions: {
        gateway: { models: ["deepseek/deepseek-v4.1-flash", "openai/gpt-6-luna"] },
      },
    });
    expect(IMPORT_GATEWAY_FALLBACK_MODELS).toEqual([
      "deepseek/deepseek-v4.1-flash",
      "openai/gpt-6-luna",
    ]);
  });

  it("drops a fallback that is the same as the primary", () => {
    expect(importGenerateOptions("deepseek/deepseek-v4.1-flash")).toEqual({
      maxRetries: IMPORT_GENERATE_MAX_RETRIES,
      providerOptions: {
        gateway: { models: ["openai/gpt-6-luna"] },
      },
    });
    expect(importGenerateOptions("spacexai/grok-4.7").providerOptions.gateway.models).toEqual([
      ...IMPORT_GATEWAY_FALLBACK_MODELS,
    ]);
  });
});

describe("remainingImportBudgetMs", () => {
  it("shrinks from the request start so page fetch plus AI stay under 50s", () => {
    expect(remainingImportBudgetMs(1_000, 1_000)).toBe(IMPORT_GENERATE_TIMEOUT_MS);
    expect(remainingImportBudgetMs(1_000, 41_000)).toBe(10_000);
    expect(remainingImportBudgetMs(1_000, 51_000)).toBe(0);
    expect(remainingImportBudgetMs(1_000, 41_000) + 40_000).toBeLessThan(60_000);
  });
});
