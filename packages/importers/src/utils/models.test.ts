import { describe, expect, it, vi } from "vitest";

vi.mock("@ai-sdk/gateway", () => ({
  gateway: (id: string) => id,
}));

import {
  DEFAULT_EXTRACT_MODEL,
  DEFAULT_VISION_MODEL,
  IMPORT_GATEWAY_FALLBACK_MODELS,
  IMPORT_GENERATE_MAX_RETRIES,
  IMPORT_GENERATE_TIMEOUT_MS,
  generateImportObject,
  importGenerateOptions,
  remainingImportBudgetMs,
  resolveDefaultModelId,
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
    expect(DEFAULT_VISION_MODEL).toBe("deepseek/deepseek-v4.1-flash");
  });

  it("ignores blank override and env values", () => {
    expect(resolveVisionModelId("  ", { RK_MODEL_VISION: "   " })).toBe(DEFAULT_VISION_MODEL);
  });
});

describe("resolveDefaultModelId", () => {
  it("uses DeepSeek when nothing is set", () => {
    expect(resolveDefaultModelId(undefined, {})).toBe("deepseek/deepseek-v4.1-flash");
  });

  it("uses RK_MODEL_DEFAULT", () => {
    expect(resolveDefaultModelId(undefined, { RK_MODEL_DEFAULT: "spacexai/grok-4.7" })).toBe(
      "spacexai/grok-4.7"
    );
  });
});

describe("resolveExtractModelId", () => {
  it("uses the same DeepSeek primary as paste when nothing is set", () => {
    expect(resolveExtractModelId(undefined, {})).toBe(DEFAULT_VISION_MODEL);
    expect(DEFAULT_EXTRACT_MODEL).toBe("deepseek/deepseek-v4.1-flash");
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
  it("pins DeepSeek without listing Luna/grok on that request", () => {
    expect(aiSdkRetryWaitMs(5)).toBeGreaterThan(60_000);
    expect(aiSdkRetryWaitMs(IMPORT_GENERATE_MAX_RETRIES)).toBeLessThan(60_000);
    expect(IMPORT_GENERATE_MAX_RETRIES).toBeLessThanOrEqual(3);
    expect(IMPORT_GENERATE_TIMEOUT_MS).toBe(50_000);
    expect(importGenerateOptions()).toEqual({
      maxRetries: IMPORT_GENERATE_MAX_RETRIES,
      providerOptions: { gateway: { only: ["deepseek"] } },
    });
    expect(importGenerateOptions("deepseek/deepseek-v4.1-flash")).toEqual(importGenerateOptions());
    expect(importGenerateOptions().providerOptions.gateway).not.toHaveProperty("models");
    expect(IMPORT_GATEWAY_FALLBACK_MODELS).toEqual(["openai/gpt-6-luna", "spacexai/grok-4.7"]);
  });

  it("leaves Luna/grok reachable without the DeepSeek only filter", () => {
    expect(importGenerateOptions("openai/gpt-6-luna")).toEqual({
      maxRetries: IMPORT_GENERATE_MAX_RETRIES,
      providerOptions: { gateway: { models: ["spacexai/grok-4.7"] } },
    });
    expect(importGenerateOptions("spacexai/grok-4.7")).toEqual({
      maxRetries: IMPORT_GENERATE_MAX_RETRIES,
      providerOptions: { gateway: { models: ["openai/gpt-6-luna"] } },
    });
  });
});

describe("generateImportObject", () => {
  it("retries Luna/grok without the DeepSeek only filter when DeepSeek is down", async () => {
    const generate = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error("Failed after 3 attempts"), { name: "AI_RetryError" }))
      .mockResolvedValueOnce({ object: { isRecipe: false } });
    await generateImportObject(generate, "deepseek/deepseek-v4.1-flash", { prompt: "x" });
    expect(generate.mock.calls[0]?.[0].providerOptions.gateway).toEqual({ only: ["deepseek"] });
    expect(generate.mock.calls[0]?.[0].providerOptions.gateway.models).toBeUndefined();
    expect(generate.mock.calls[1]?.[0].providerOptions.gateway).toEqual({
      models: ["spacexai/grok-4.7"],
    });
    expect(generate.mock.calls[1]?.[0].providerOptions.gateway.only).toBeUndefined();
  });

  it("does not pin fallbacks when Luna is the primary", async () => {
    const generate = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error("Failed after 3 attempts"), { name: "AI_RetryError" }));
    await expect(
      generateImportObject(generate, "openai/gpt-6-luna", { prompt: "x" })
    ).rejects.toMatchObject({ name: "AI_RetryError" });
    expect(generate).toHaveBeenCalledTimes(1);
    expect(generate.mock.calls[0]?.[0].providerOptions.gateway.only).toBeUndefined();
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
