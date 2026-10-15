import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PHOTO_IMPORT_TIMEOUT_MESSAGE,
  PHOTO_IMPORT_TIMEOUT_MS,
  extractPhotoPreviewFromFiles,
  photoImportErrorMessage,
  photoImportStepReached,
} from "./photo-import-client";

const preview = {
  title: "Weeknight Tomato Pasta",
  ingredients: [{ rawText: "12 oz pasta" }],
  steps: [{ text: "Boil pasta." }],
  images: ["https://blob.example/main.jpg"],
  source: { type: "photo", importerName: "photo-importer", importerVersion: "0.1.0" },
  overallConfidence: 0.8,
  needsReview: true,
  reviewReasons: [],
  uncertainFields: [],
  allergenClassifications: [],
};

describe("photoImportStepReached", () => {
  it("marks Uploading through Ready to review in order", () => {
    expect(photoImportStepReached("uploading", "uploading")).toBe(true);
    expect(photoImportStepReached("reading", "uploading")).toBe(false);
    expect(photoImportStepReached("reading", "reading")).toBe(true);
    expect(photoImportStepReached("review", "reading")).toBe(false);
    expect(photoImportStepReached("review", "review")).toBe(true);
  });
});

describe("extractPhotoPreviewFromFiles", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => preview,
      })
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("marks uploading then reading before the preview returns", async () => {
    const phases: string[] = [];
    let resolveFetch:
      ((value: { ok: boolean; json: () => Promise<typeof preview> }) => void) | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveFetch = resolve;
          })
      )
    );

    const pending = extractPhotoPreviewFromFiles(
      [new File(["card"], "card.jpg", { type: "image/jpeg" })],
      { onPhase: (phase) => phases.push(phase) }
    );
    await vi.waitFor(() => expect(phases).toEqual(["uploading", "reading"]));
    expect(fetch).toHaveBeenCalledWith(
      "/api/v1/recipes/import/photo",
      expect.objectContaining({ method: "POST", credentials: "include" })
    );
    resolveFetch?.({ ok: true, json: async () => preview });
    await expect(pending).resolves.toMatchObject({ title: "Weeknight Tomato Pasta" });
  });

  it("times out around 60s with a clear retry message", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((_url: string, init?: { signal?: AbortSignal }) => {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            const error = new Error("The operation was aborted");
            error.name = "AbortError";
            reject(error);
          });
        });
      })
    );

    const pending = extractPhotoPreviewFromFiles(
      [new File(["card"], "card.jpg", { type: "image/jpeg" })],
      { timeoutMs: PHOTO_IMPORT_TIMEOUT_MS }
    );
    const assertion = expect(pending).rejects.toMatchObject({
      name: "TimeoutError",
      message: PHOTO_IMPORT_TIMEOUT_MESSAGE,
    });
    await vi.advanceTimersByTimeAsync(PHOTO_IMPORT_TIMEOUT_MS);
    await assertion;
  });

  it("surfaces a cancelled import separately from a timeout", async () => {
    const controller = new AbortController();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(
        () =>
          new Promise(() => {
            /* hang until abort */
          })
      )
    );
    const pending = extractPhotoPreviewFromFiles(
      [new File(["card"], "card.jpg", { type: "image/jpeg" })],
      { signal: controller.signal }
    );
    controller.abort();
    const error = await pending.catch((err: unknown) => err);
    expect(error).toMatchObject({ name: "AbortError" });
    expect(photoImportErrorMessage(error)).toBe("Photo import cancelled");
  });
});
