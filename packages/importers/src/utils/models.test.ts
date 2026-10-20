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
  it("uses the cheap gateway default, not RK_MODEL_DEFAULT", () => {
    expect(resolveExtractModelId(undefined, { RK_MODEL_DEFAULT: "spacexai/grok-4.7" })).toBe(
      DEFAULT_EXTRACT_MODEL
    );
    expect(DEFAULT_EXTRACT_MODEL).toBe("openai/gpt-4o-mini");
  });

  it("uses RK_MODEL_EXTRACT when set", () => {
    expect(resolveExtractModelId(undefined, { RK_MODEL_EXTRACT: "google/gemini-2.5-flash" })).toBe(
      "google/gemini-2.5-flash"
    );
  });

  it("uses the explicit override first", () => {
    expect(
      resolveExtractModelId("openai/gpt-4o-mini", { RK_MODEL_EXTRACT: "google/gemini-2.5-flash" })
    ).toBe("openai/gpt-4o-mini");
  });
});

describe("importGenerateOptions", () => {
  it("retries past a short 503 burst and falls back to grok-4.6 then gpt-4o-mini", () => {
    expect(IMPORT_GENERATE_MAX_RETRIES).toBeGreaterThan(2);
    expect(importGenerateOptions()).toEqual({
      maxRetries: IMPORT_GENERATE_MAX_RETRIES,
      providerOptions: {
        gateway: { models: ["spacexai/grok-4.6", "openai/gpt-4o-mini"] },
      },
    });
    expect(IMPORT_GATEWAY_FALLBACK_MODELS).toEqual(["spacexai/grok-4.6", "openai/gpt-4o-mini"]);
  });
});
