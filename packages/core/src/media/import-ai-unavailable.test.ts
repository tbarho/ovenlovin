import { describe, expect, it } from "vitest";
import {
  IMPORT_BLOCKED_CODE,
  IMPORT_BLOCKED_MESSAGE,
  IMPORT_NOT_A_RECIPE_CODE,
  IMPORT_NOT_A_RECIPE_MESSAGE,
  IMPORT_PAGE_GONE_CODE,
  IMPORT_PAGE_GONE_MESSAGE,
  classifyImportFailure,
  importAiUnavailableMeta,
  isImportAiNotARecipe,
  isImportAiUnavailable,
  tagImportAiTimeout,
} from "./import-ai-unavailable";
import {
  NOT_A_PUBLIC_URL_CODE,
  NOT_A_PUBLIC_URL_MESSAGE,
  NotAPublicUrlError,
} from "./public-http-url";

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

  it("maps gateway 5xx as unavailable and schema-miss as not-a-recipe", () => {
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
    ).toBe(false);
    expect(
      isImportAiNotARecipe(
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

  it("classifies checkpoint, 404, and not-a-recipe with paste or photo", () => {
    const blocked = classifyImportFailure(
      Object.assign(new Error("This site blocked the importer."), {
        name: "RecipeImportFetchError",
      })
    );
    expect(blocked).toEqual({ code: IMPORT_BLOCKED_CODE, message: IMPORT_BLOCKED_MESSAGE });
    expect(blocked?.message).toMatch(/Paste the recipe text or add a photo/);

    const gone = classifyImportFailure(
      Object.assign(new Error("That page is gone."), { name: "RecipePageGoneError" })
    );
    expect(gone).toEqual({ code: IMPORT_PAGE_GONE_CODE, message: IMPORT_PAGE_GONE_MESSAGE });
    expect(gone?.message).toMatch(/Paste the recipe text or add a photo/);

    const notRecipe = classifyImportFailure(
      Object.assign(new Error("This is not a recipe page."), { name: "RecipeNotFoundError" })
    );
    expect(notRecipe).toEqual({
      code: IMPORT_NOT_A_RECIPE_CODE,
      message: IMPORT_NOT_A_RECIPE_MESSAGE,
    });
    expect(notRecipe?.message).toMatch(/Paste the recipe text or add a photo/);
    expect(
      classifyImportFailure(
        Object.assign(new Error("No object generated"), { name: "AI_NoObjectGeneratedError" })
      )?.code
    ).toBe(IMPORT_NOT_A_RECIPE_CODE);

    expect(
      classifyImportFailure(
        Object.assign(new Error("We couldn't find a recipe."), {
          name: "RecipeNotFoundError",
          directBlocked: true,
        })
      )?.code
    ).toBe(IMPORT_BLOCKED_CODE);
    const aiBusy = Object.assign(new Error("aborted"), {
      name: "TimeoutError",
      importAiTimeout: true,
      directBlocked: true,
    });
    expect(classifyImportFailure(aiBusy)).toBeNull();
    expect(isImportAiUnavailable(aiBusy)).toBe(true);
    expect(classifyImportFailure(new NotAPublicUrlError())).toEqual({
      code: NOT_A_PUBLIC_URL_CODE,
      message: NOT_A_PUBLIC_URL_MESSAGE,
    });
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
