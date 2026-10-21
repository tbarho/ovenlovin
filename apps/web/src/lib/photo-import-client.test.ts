import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PHOTO_IMPORT_BLURRY_MESSAGE,
  PHOTO_IMPORT_ESTIMATE,
  PHOTO_IMPORT_NETWORK_MESSAGE,
  PHOTO_IMPORT_NOT_RECIPE_MESSAGE,
  PHOTO_IMPORT_TIMEOUT_MESSAGE,
  PHOTO_IMPORT_TIMEOUT_MS,
  PHOTO_IMPORT_TOO_LARGE_MESSAGE,
  PHOTO_SAVE_NO_IMAGE_MESSAGE,
  classifyPhotoImportProblem,
  dataUrlPayloadBytes,
  extractPhotoPreviewFromFiles,
  photoImportAnnouncement,
  photoImportErrorMessage,
  photoImportStepReached,
  uploadingStepLabel,
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

type MockXhr = {
  upload: { onprogress: ((event: ProgressEvent) => void) | null; onload: (() => void) | null };
  onload: (() => void) | null;
  onerror: (() => void) | null;
  ontimeout: (() => void) | null;
  onabort: (() => void) | null;
  status: number;
  responseText: string;
  timeout: number;
  withCredentials: boolean;
  open: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
  abort: ReturnType<typeof vi.fn>;
};

function mockXhr(init?: (xhr: MockXhr) => void) {
  const xhr: MockXhr = {
    upload: { onprogress: null, onload: null },
    onload: null,
    onerror: null,
    ontimeout: null,
    onabort: null,
    status: 200,
    responseText: JSON.stringify(preview),
    timeout: 0,
    withCredentials: false,
    open: vi.fn(),
    send: vi.fn(function (this: MockXhr) {
      this.upload.onprogress?.({ lengthComputable: true, loaded: 40, total: 100 } as ProgressEvent);
      this.upload.onload?.();
      this.onload?.();
    }),
    abort: vi.fn(function (this: MockXhr) {
      this.onabort?.();
    }),
  };
  init?.(xhr);
  vi.stubGlobal(
    "XMLHttpRequest",
    vi.fn(function (this: MockXhr) {
      return xhr;
    })
  );
  return xhr;
}

describe("photoImportStepReached", () => {
  it("marks Uploading through Ready to review in order", () => {
    expect(photoImportStepReached("uploading", "uploading")).toBe(true);
    expect(photoImportStepReached("reading", "uploading")).toBe(false);
    expect(photoImportStepReached("reading", "reading")).toBe(true);
    expect(photoImportStepReached("review", "reading")).toBe(false);
    expect(photoImportStepReached("review", "review")).toBe(true);
  });
});

describe("photo import copy helpers", () => {
  it("names Uploading with a percent and announces the 15 second estimate", () => {
    expect(uploadingStepLabel(32)).toBe("Uploading 32%");
    expect(photoImportAnnouncement("uploading", 32)).toContain("32%");
    expect(photoImportAnnouncement("uploading", 32)).toContain(PHOTO_IMPORT_ESTIMATE);
    expect(photoImportAnnouncement("reading", 100)).toBe(`Reading. ${PHOTO_IMPORT_ESTIMATE}.`);
    expect(photoImportAnnouncement("review", 100)).toBe("Ready to review.");
  });

  it("maps blurry, not a recipe, and network problems to their own messages", () => {
    expect(classifyPhotoImportProblem({ code: "PHOTO_BLURRY" })).toBe("blurry");
    expect(classifyPhotoImportProblem({ code: "PHOTO_NOT_RECIPE" })).toBe("not_recipe");
    expect(classifyPhotoImportProblem({ detail: "No recipe found on this page." })).toBe(
      "not_recipe"
    );
    expect(
      classifyPhotoImportProblem({
        code: "import_not_a_recipe",
        detail: "We couldn't find a recipe in that text/photo",
      })
    ).toBe("not_recipe");
    expect(
      photoImportErrorMessage(Object.assign(new Error("Failed to fetch"), { name: "TypeError" }))
    ).toBe(PHOTO_IMPORT_NETWORK_MESSAGE);
    expect(photoImportErrorMessage(new Error(PHOTO_IMPORT_BLURRY_MESSAGE))).toBe(
      PHOTO_IMPORT_BLURRY_MESSAGE
    );
    expect(photoImportErrorMessage(new Error(PHOTO_IMPORT_NOT_RECIPE_MESSAGE))).toBe(
      PHOTO_IMPORT_NOT_RECIPE_MESSAGE
    );
    expect(photoImportErrorMessage(new Error("Request Entity Too Large"))).toBe(
      PHOTO_IMPORT_TOO_LARGE_MESSAGE
    );
  });

  it("tells the cook the recipe saved when only the photo upload failed", () => {
    expect(PHOTO_SAVE_NO_IMAGE_MESSAGE).toContain("Recipe saved");
    expect(PHOTO_SAVE_NO_IMAGE_MESSAGE).toContain("do not import it again");
  });

  it("counts the decoded bytes of a data URL", () => {
    expect(dataUrlPayloadBytes("data:image/jpeg;base64,aaaa")).toBe(3);
  });
});

describe("extractPhotoPreviewFromFiles", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("marks uploading with progress then reading before the preview returns", async () => {
    const phases: string[] = [];
    const percents: number[] = [];
    let pendingXhr: MockXhr | undefined;
    mockXhr((xhr) => {
      pendingXhr = xhr;
      xhr.send = vi.fn();
    });

    const pending = extractPhotoPreviewFromFiles(
      [new File(["card"], "card.jpg", { type: "image/jpeg" })],
      {
        onPhase: (phase) => phases.push(phase),
        onUploadProgress: (percent) => percents.push(percent),
      }
    );
    await vi.waitFor(() => expect(pendingXhr?.send).toHaveBeenCalled());
    expect(phases).toContain("uploading");
    pendingXhr?.upload.onprogress?.({
      lengthComputable: true,
      loaded: 32,
      total: 100,
    } as ProgressEvent);
    pendingXhr?.upload.onload?.();
    pendingXhr?.onload?.();
    await expect(pending).resolves.toMatchObject({ title: "Weeknight Tomato Pasta" });
    expect(phases).toEqual(["uploading", "reading"]);
    expect(percents).toContain(32);
    expect(percents).toContain(100);
  });

  it("times out around 60s with a clear retry message", async () => {
    const xhr = mockXhr((instance) => {
      instance.send = vi.fn();
    });
    const pending = extractPhotoPreviewFromFiles(
      [new File(["card"], "card.jpg", { type: "image/jpeg" })],
      { timeoutMs: PHOTO_IMPORT_TIMEOUT_MS }
    );
    await vi.waitFor(() => expect(xhr.send).toHaveBeenCalled());
    expect(xhr.timeout).toBe(PHOTO_IMPORT_TIMEOUT_MS);
    const assertion = expect(pending).rejects.toMatchObject({
      name: "TimeoutError",
      message: PHOTO_IMPORT_TIMEOUT_MESSAGE,
    });
    xhr.ontimeout?.();
    await assertion;
  });

  it("surfaces a cancelled import separately from a timeout", async () => {
    const controller = new AbortController();
    mockXhr((xhr) => {
      xhr.send = vi.fn();
    });
    const pending = extractPhotoPreviewFromFiles(
      [new File(["card"], "card.jpg", { type: "image/jpeg" })],
      { signal: controller.signal }
    );
    controller.abort();
    const error = await pending.catch((err: unknown) => err);
    expect(error).toMatchObject({ name: "AbortError" });
    expect(photoImportErrorMessage(error)).toBe("Photo import cancelled");
  });

  it("uploads the original file without a client resize", async () => {
    const createImageBitmap = vi.fn();
    vi.stubGlobal("createImageBitmap", createImageBitmap);
    const xhr = mockXhr();
    const file = new File([new Uint8Array(3 * 1024 * 1024)], "test-card.png", {
      type: "image/png",
    });
    await extractPhotoPreviewFromFiles([file]);
    expect(createImageBitmap).not.toHaveBeenCalled();
    const sent = xhr.send.mock.calls[0]?.[0] as FormData;
    const uploaded = sent.get("image") as File;
    expect(uploaded.size).toBe(file.size);
    expect(uploaded.name).toBe("test-card.png");
    expect(uploaded.type).toBe("image/png");
  });

  it("resizes a file over 4MB before upload", async () => {
    const createImageBitmap = vi.fn().mockResolvedValue({
      width: 4000,
      height: 3000,
      close: vi.fn(),
    });
    vi.stubGlobal("createImageBitmap", createImageBitmap);
    vi.stubGlobal("document", {
      createElement: () => ({
        width: 0,
        height: 0,
        getContext: () => ({ drawImage: vi.fn() }),
        toBlob: (cb: (blob: Blob | null) => void) =>
          cb(new Blob([new Uint8Array(80)], { type: "image/jpeg" })),
      }),
    });
    const xhr = mockXhr();
    const file = new File([new Uint8Array(4 * 1024 * 1024 + 1)], "phone.jpg", {
      type: "image/jpeg",
    });
    await extractPhotoPreviewFromFiles([file]);
    expect(createImageBitmap).toHaveBeenCalled();
    const uploaded = (xhr.send.mock.calls[0]?.[0] as FormData).get("image") as File;
    expect(uploaded.size).toBe(80);
    expect(uploaded.type).toBe("image/jpeg");
  });

  it("maps a 413 to a crop message", async () => {
    mockXhr((xhr) => {
      xhr.status = 413;
      xhr.responseText = "Request Entity Too Large";
    });
    await expect(
      extractPhotoPreviewFromFiles([new File(["card"], "card.jpg", { type: "image/jpeg" })])
    ).rejects.toMatchObject({ message: PHOTO_IMPORT_TOO_LARGE_MESSAGE });
  });

  it("maps a PHOTO_BLURRY problem to the blurry message", async () => {
    mockXhr((xhr) => {
      xhr.status = 400;
      xhr.responseText = JSON.stringify({
        code: "PHOTO_BLURRY",
        detail: PHOTO_IMPORT_BLURRY_MESSAGE,
      });
    });
    await expect(
      extractPhotoPreviewFromFiles([new File(["card"], "card.jpg", { type: "image/jpeg" })])
    ).rejects.toMatchObject({ message: PHOTO_IMPORT_BLURRY_MESSAGE });
  });
});
