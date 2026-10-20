import { describe, expect, it } from "vitest";
import {
  importAiUnavailableMeta,
  isImportAiUnavailable,
  tagImportAiTimeout,
} from "./import-ai-unavailable";

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

  it("treats only a tagged importer timeout as unavailable", () => {
    const timeout = Object.assign(new Error("aborted"), { name: "TimeoutError" });
    const abort = Object.assign(new Error("aborted"), { name: "AbortError" });
    expect(isImportAiUnavailable(timeout)).toBe(false);
    expect(isImportAiUnavailable(abort)).toBe(false);
    expect(isImportAiUnavailable(tagImportAiTimeout(timeout))).toBe(true);
    expect(isImportAiUnavailable(tagImportAiTimeout(abort))).toBe(true);
  });

  it("maps gateway 5xx and schema-miss errors, not a 400", () => {
    expect(
      isImportAiUnavailable(
        Object.assign(new Error("Bad gateway"), { name: "AI_APICallError", statusCode: 502 })
      )
    ).toBe(true);
    expect(
      isImportAiUnavailable(
        Object.assign(new Error("Internal"), { name: "AI_APICallError", statusCode: 500 })
      )
    ).toBe(true);
    expect(
      isImportAiUnavailable(
        Object.assign(new Error("No object generated: response did not match schema."), {
          name: "AI_NoObjectGeneratedError",
        })
      )
    ).toBe(true);
    expect(
      isImportAiUnavailable(
        Object.assign(new Error("Bad request"), { name: "AI_APICallError", statusCode: 400 })
      )
    ).toBe(false);
  });

  it("tags a timeout nested under an AI call error", () => {
    const timeout = Object.assign(new Error("aborted"), { name: "TimeoutError" });
    const wrapped = Object.assign(new Error("Failed after 3 attempts"), {
      name: "AI_APICallError",
      statusCode: 400,
      cause: timeout,
    });
    expect(isImportAiUnavailable(wrapped)).toBe(false);
    expect(isImportAiUnavailable(tagImportAiTimeout(wrapped))).toBe(true);
  });
});
