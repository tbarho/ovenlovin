import { describe, expect, it } from "vitest";
import {
  DEFAULT_EXTRACT_MODEL,
  DEFAULT_VISION_MODEL,
  IMPORT_GATEWAY_FALLBACK_MODELS,
  IMPORT_GENERATE_MAX_RETRIES,
  importGenerateOptions,
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

describe("importGenerateOptions", () => {
  it("retries past a short 503 burst and falls back to gpt-6-luna then grok-4.7", () => {
    expect(IMPORT_GENERATE_MAX_RETRIES).toBeGreaterThan(2);
    expect(importGenerateOptions()).toEqual({
      maxRetries: IMPORT_GENERATE_MAX_RETRIES,
      providerOptions: {
        gateway: { models: ["openai/gpt-6-luna", "spacexai/grok-4.7"] },
      },
    });
    expect(IMPORT_GATEWAY_FALLBACK_MODELS).toEqual(["openai/gpt-6-luna", "spacexai/grok-4.7"]);
  });
});
