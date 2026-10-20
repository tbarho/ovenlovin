import { describe, expect, it } from "vitest";
import { importAiUnavailableMeta, isImportAiUnavailable } from "./import-ai-unavailable";

describe("importAiUnavailableMeta", () => {
  it("reads provider, model, statusCode, and generationId from nested AI errors", () => {
    const error = Object.assign(new Error("Failed after 3 attempts"), {
      name: "AI_RetryError",
      lastError: {
        name: "AI_APICallError",
        statusCode: 503,
        modelId: "spacexai/grok-4.7",
        data: {
          provider: "xai",
          generationId: "gen_test_123",
        },
      },
    });
    expect(isImportAiUnavailable(error)).toBe(true);
    expect(importAiUnavailableMeta(error)).toEqual({
      provider: "xai",
      model: "spacexai/grok-4.7",
      statusCode: 503,
      generationId: "gen_test_123",
    });
  });

  it("treats a generateObject timeout as unavailable", () => {
    expect(
      isImportAiUnavailable(Object.assign(new Error("aborted"), { name: "TimeoutError" }))
    ).toBe(true);
    expect(isImportAiUnavailable(Object.assign(new Error("aborted"), { name: "AbortError" }))).toBe(
      true
    );
  });
});
