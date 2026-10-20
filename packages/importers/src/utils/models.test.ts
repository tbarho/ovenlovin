import { describe, expect, it } from "vitest";
import {
  DEFAULT_EXTRACT_MODEL,
  DEFAULT_VISION_MODEL,
  IMPORT_GATEWAY_FALLBACK_MODELS,
  IMPORT_GENERATE_MAX_RETRIES,
  importGenerateOptions,
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
});
