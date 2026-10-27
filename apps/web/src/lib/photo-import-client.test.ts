import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PHOTO_IMPORT_BLURRY_MESSAGE,
  PHOTO_IMPORT_BUDGET_BYTES,
  PHOTO_IMPORT_FALLBACK_QUALITY,
  PHOTO_IMPORT_MAX_PAGES,
  PHOTO_IMPORT_QUALITY,
  PHOTO_IMPORT_TOO_MANY_PAGES_MESSAGE,
  PHOTO_IMPORT_ESTIMATE,
  PHOTO_IMPORT_NEAR_TIMEOUT,
  PHOTO_IMPORT_NETWORK_MESSAGE,
  PHOTO_IMPORT_NOT_RECIPE_MESSAGE,
  PHOTO_IMPORT_SLOW,
  PHOTO_IMPORT_TIMEOUT_MESSAGE,
  PHOTO_IMPORT_TIMEOUT_MS,
  PHOTO_IMPORT_TOO_LARGE_MESSAGE,
  PHOTO_SAVE_NO_IMAGE_MESSAGE,
  PHOTO_IMPORT_ENHANCE_MAX_EDGE,
  PHOTO_IMPORT_ENHANCE_QUALITY,
  PHOTO_IMPORT_SHARPER_ANNOUNCEMENT,
  PHOTO_IMPORT_STILL_BLURRY,
  addPhotoPages,
  budgetPhotoFiles,
  enhancePhotoFiles,
  enhancePixels,
  shouldOfferSharperRead,
  classifyPhotoImportProblem,
  dataUrlPayloadBytes,
  elapsedLabel,
  extractPhotoPreviewFromFiles,
  movePhotoPage,
  photoCopyForPages,
  photoImportAnnouncement,
  photoImportButtonLabel,
  photoImportErrorMessage,
  photoImportLead,
  photoImportStepState,
  readingStepLabel,
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

describe("photoImportStepState", () => {
  it("marks earlier steps done, the active step current, and later steps todo", () => {
    expect(photoImportStepState("uploading", "uploading")).toBe("current");
    expect(photoImportStepState("reading", "uploading")).toBe("todo");
    expect(photoImportStepState("uploading", "reading")).toBe("done");
    expect(photoImportStepState("reading", "reading")).toBe("current");
    expect(photoImportStepState("review", "reading")).toBe("todo");
    expect(photoImportStepState("reading", "error")).toBe("current");
    expect(photoImportStepState("review", "review")).toBe("done");
    expect(photoImportStepState("uploading", "review")).toBe("done");
  });
});

describe("photo import copy helpers", () => {
  it("promises under a minute, not a fixed short estimate", () => {
    expect(PHOTO_IMPORT_ESTIMATE).toBe("Usually under a minute");
    expect(PHOTO_IMPORT_ESTIMATE).not.toMatch(/15/);
  });

  it("labels steps and the reading timer", () => {
    expect(uploadingStepLabel(32)).toBe("Uploading 32%");
    expect(readingStepLabel(1)).toBe("Reading");
    expect(readingStepLabel(2)).toBe("Reading 2 pages");
    expect(readingStepLabel(2, true)).toBe("Sharper read");
    expect(elapsedLabel(12_400)).toBe("0:12");
    expect(elapsedLabel(65_000)).toBe("1:05");
  });

  it("changes the lead line at 30s and near the timeout", () => {
    expect(photoImportLead(0)).toBe(`${PHOTO_IMPORT_ESTIMATE}.`);
    expect(photoImportLead(29_999)).toBe(`${PHOTO_IMPORT_ESTIMATE}.`);
    expect(photoImportLead(30_000)).toBe(PHOTO_IMPORT_SLOW);
    expect(photoImportLead(50_000)).toBe(PHOTO_IMPORT_NEAR_TIMEOUT);
  });

  it("announces only transitions, not percent or seconds", () => {
    expect(photoImportAnnouncement("uploading")).toBe("Uploading.");
    expect(photoImportAnnouncement("uploading", { enhanced: true })).toBe(
      PHOTO_IMPORT_SHARPER_ANNOUNCEMENT
    );
    expect(photoImportAnnouncement("reading", { elapsedMs: 1_000 })).toBe(
      `Upload done. Reading 1 page. ${PHOTO_IMPORT_ESTIMATE}.`
    );
    expect(photoImportAnnouncement("reading", { elapsedMs: 12_000, pages: 2 })).toBe(
      `Upload done. Reading 2 pages. ${PHOTO_IMPORT_ESTIMATE}.`
    );
    expect(photoImportAnnouncement("reading", { elapsedMs: 31_000 })).toBe("Still reading.");
    expect(photoImportAnnouncement("reading", { elapsedMs: 44_000 })).toBe("Still reading.");
    expect(photoImportAnnouncement("reading", { elapsedMs: 51_000 })).toBe(
      PHOTO_IMPORT_NEAR_TIMEOUT
    );
    expect(photoImportAnnouncement("review")).toBe("Ready to review.");
    expect(photoImportAnnouncement("error", { errorMessage: "Nope" })).toBe("Nope");
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

const MB = 1024 * 1024;

function sized(name: string, bytes: number): File {
  return new File([new Uint8Array(bytes)], name, { type: "image/jpeg" });
}

describe("budgetPhotoFiles", () => {
  it("leaves pages alone when the total fits", async () => {
    const resize = vi.fn();
    const files = [sized("a.jpg", 1 * MB), sized("b.jpg", 2 * MB)];
    await expect(budgetPhotoFiles(files, resize)).resolves.toBe(files);
    expect(resize).not.toHaveBeenCalled();
  });

  it("resizes every page, one at a time, when the total is over budget", async () => {
    let active = 0;
    const resize = vi.fn(async (file: File, _options: { quality: number }) => {
      active += 1;
      expect(active).toBe(1);
      await Promise.resolve();
      active -= 1;
      return sized(file.name, 400_000);
    });
    const files = [sized("a.jpg", 3 * MB), sized("b.jpg", 3 * MB), sized("c.jpg", 3 * MB)];
    const out = await budgetPhotoFiles(files, resize);
    expect(out.map((file) => file.name)).toEqual(["a.jpg", "b.jpg", "c.jpg"]);
    expect(out.reduce((sum, file) => sum + file.size, 0)).toBeLessThanOrEqual(
      PHOTO_IMPORT_BUDGET_BYTES
    );
    expect(resize).toHaveBeenCalledTimes(3);
    expect(resize.mock.calls[0]?.[1]).toMatchObject({ quality: PHOTO_IMPORT_QUALITY });
  });

  it("steps quality down once before giving up", async () => {
    const resize = vi.fn(async (file: File, options: { quality: number }) =>
      sized(file.name, options.quality === PHOTO_IMPORT_QUALITY ? 1.5 * MB : 1 * MB)
    );
    const files = [sized("a.jpg", 3 * MB), sized("b.jpg", 3 * MB), sized("c.jpg", 3 * MB)];
    const out = await budgetPhotoFiles(files, resize);
    expect(out.every((file) => file.size === 1 * MB)).toBe(true);
    expect(resize.mock.calls.at(-1)?.[1]).toMatchObject({
      quality: PHOTO_IMPORT_FALLBACK_QUALITY,
    });
  });

  it("blocks before upload when pages still do not fit", async () => {
    const resize = vi.fn(async (file: File) => sized(file.name, 1 * MB));
    const files = Array.from({ length: 6 }, (_, index) => sized(`${index}.jpg`, 3 * MB));
    await expect(budgetPhotoFiles(files, resize)).rejects.toThrow(
      PHOTO_IMPORT_TOO_MANY_PAGES_MESSAGE
    );
    expect(resize).toHaveBeenCalledTimes(12);
  });

  it("never uploads when the budget blocks", async () => {
    vi.stubGlobal("createImageBitmap", undefined);
    const xhr = mockXhr();
    const files = [sized("a.jpg", 2 * MB), sized("b.jpg", 2 * MB)];
    await expect(extractPhotoPreviewFromFiles(files)).rejects.toThrow(
      PHOTO_IMPORT_TOO_MANY_PAGES_MESSAGE
    );
    expect(xhr.send).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe("photo page helpers", () => {
  it("caps added pages", () => {
    const files = Array.from({ length: 8 }, (_, index) => sized(`${index}.jpg`, 1));
    expect(addPhotoPages(files.slice(0, 4), files.slice(4))).toHaveLength(PHOTO_IMPORT_MAX_PAGES);
  });

  it("moves a page and ignores moves off the ends", () => {
    expect(movePhotoPage(["a", "b", "c"], 2, 1)).toEqual(["a", "c", "b"]);
    expect(movePhotoPage(["a", "b", "c"], 0, 1)).toEqual(["b", "a", "c"]);
    const items = ["a", "b"];
    expect(movePhotoPage(items, 0, -1)).toBe(items);
    expect(movePhotoPage(items, 1, 2)).toBe(items);
  });

  it("labels the import button by page count", () => {
    expect(photoImportButtonLabel(1)).toBe("Import recipe");
    expect(photoImportButtonLabel(3)).toBe("Import 3 pages");
  });

  it("rewords single-photo errors for a set of pages", () => {
    expect(photoCopyForPages(PHOTO_IMPORT_TIMEOUT_MESSAGE, 1)).toBe(PHOTO_IMPORT_TIMEOUT_MESSAGE);
    expect(photoCopyForPages(PHOTO_IMPORT_TIMEOUT_MESSAGE, 2)).toBe(
      "These pages took too long to read. Try again, or type or paste it."
    );
    expect(photoCopyForPages(PHOTO_IMPORT_TOO_LARGE_MESSAGE, 2)).toBe(
      "These pages are too large. Try a closer crop."
    );
    expect(photoCopyForPages("Could not read that photo", 3)).toBe("Could not read these pages");
  });
});

function rgba(pixels: number[][]): Uint8ClampedArray {
  return new Uint8ClampedArray(pixels.flatMap(([r, g, b]) => [r!, g!, b!, 255]));
}

describe("enhancePixels", () => {
  it("turns color to gray and stretches a dim range to full contrast", () => {
    const data = rgba([
      [100, 90, 80],
      [100, 90, 80],
      [140, 130, 120],
      [140, 130, 120],
    ]);
    enhancePixels(data, 2, 2);
    for (let i = 0; i < 16; i += 4) {
      expect(data[i]).toBe(data[i + 1]);
      expect(data[i + 1]).toBe(data[i + 2]);
      expect(data[i + 3]).toBe(255);
    }
    expect(data[0]).toBe(0);
    expect(data[8]).toBe(255);
  });

  it("leaves a flat page flat, so it cannot invent strokes", () => {
    const data = rgba(Array.from({ length: 9 }, () => [200, 200, 200]));
    enhancePixels(data, 3, 3);
    const values = new Set(Array.from(data).filter((_, index) => index % 4 === 0));
    expect(values.size).toBe(1);
  });

  it("sharpens an edge without moving it", () => {
    const row = [40, 40, 40, 220, 220, 220];
    const data = rgba(row.map((v) => [v, v, v]));
    enhancePixels(data, 6, 1);
    const out = Array.from({ length: 6 }, (_, i) => data[i * 4]!);
    expect(out[2]!).toBeLessThanOrEqual(out[1]!);
    expect(out[3]!).toBeGreaterThanOrEqual(out[4]!);
    expect(out[2]!).toBeLessThan(128);
    expect(out[3]!).toBeGreaterThan(128);
  });
});

describe("enhancePhotoFiles", () => {
  it("enhances every original page one at a time at the sharper-read size", async () => {
    let active = 0;
    const enhance = vi.fn(async (file: File, _options: { maxEdge: number; quality: number }) => {
      active += 1;
      expect(active).toBe(1);
      await Promise.resolve();
      active -= 1;
      return sized(file.name, 500_000);
    });
    const files = [sized("a.jpg", 100), sized("b.jpg", 100)];
    const out = await enhancePhotoFiles(files, enhance);
    expect(out).toHaveLength(2);
    expect(enhance.mock.calls[0]?.[1]).toEqual({
      maxEdge: PHOTO_IMPORT_ENHANCE_MAX_EDGE,
      quality: PHOTO_IMPORT_ENHANCE_QUALITY,
    });
  });

  it("steps down until the pages fit the shared budget", async () => {
    const enhance = vi.fn(async (file: File, options: { maxEdge: number }) =>
      sized(file.name, options.maxEdge === PHOTO_IMPORT_ENHANCE_MAX_EDGE ? 2 * MB : 1 * MB)
    );
    const files = [sized("a.jpg", 100), sized("b.jpg", 100), sized("c.jpg", 100)];
    const out = await enhancePhotoFiles(files, enhance);
    expect(out.reduce((sum, file) => sum + file.size, 0)).toBeLessThanOrEqual(
      PHOTO_IMPORT_BUDGET_BYTES
    );
  });

  it("blocks when enhanced pages never fit", async () => {
    const enhance = vi.fn(async (file: File) => sized(file.name, 2 * MB));
    await expect(
      enhancePhotoFiles([sized("a.jpg", 1), sized("b.jpg", 1)], enhance)
    ).rejects.toThrow(PHOTO_IMPORT_TOO_MANY_PAGES_MESSAGE);
  });

  it("sends enhanced=1 with the enhanced pages", async () => {
    vi.stubGlobal("createImageBitmap", undefined);
    const xhr = mockXhr();
    await extractPhotoPreviewFromFiles([sized("a.jpg", 100)], { enhanced: true });
    const form = xhr.send.mock.calls[0]?.[0] as FormData;
    expect(form.get("enhanced")).toBe("1");
    vi.unstubAllGlobals();
  });

  it("does not flag a normal read", async () => {
    const xhr = mockXhr();
    await extractPhotoPreviewFromFiles([sized("a.jpg", 100)]);
    expect((xhr.send.mock.calls[0]?.[0] as FormData).get("enhanced")).toBeNull();
  });
});

describe("shouldOfferSharperRead", () => {
  const read = (ocrQuality: string, uncertainFields: string[]) => ({
    uncertainFields,
    source: { rawExtractionJson: { ocrQuality } },
  });

  it("offers on a blurry error", () => {
    expect(shouldOfferSharperRead({ errorKind: "blurry" })).toBe(true);
  });

  it("offers on a poor or fair review with uncertain fields", () => {
    expect(shouldOfferSharperRead({ preview: read("poor", ["steps"]) })).toBe(true);
    expect(shouldOfferSharperRead({ preview: read("fair", ["ingredients"]) })).toBe(true);
  });

  it("never offers on a good read or one with nothing uncertain", () => {
    expect(shouldOfferSharperRead({ preview: read("good", ["steps"]) })).toBe(false);
    expect(shouldOfferSharperRead({ preview: read("excellent", []) })).toBe(false);
    expect(shouldOfferSharperRead({ preview: read("poor", []) })).toBe(false);
    expect(shouldOfferSharperRead({ errorKind: "timeout" })).toBe(false);
    expect(shouldOfferSharperRead({ errorKind: "not_recipe" })).toBe(false);
  });

  it("never offers a third read", () => {
    expect(shouldOfferSharperRead({ enhanced: true, errorKind: "blurry" })).toBe(false);
    expect(shouldOfferSharperRead({ enhanced: true, preview: read("poor", ["steps"]) })).toBe(
      false
    );
  });

  it("classifies the still-blurry copy as blurry", () => {
    expect(classifyPhotoImportProblem({ detail: PHOTO_IMPORT_STILL_BLURRY })).toBe("blurry");
    expect(classifyPhotoImportProblem({ detail: PHOTO_IMPORT_BLURRY_MESSAGE })).toBe("blurry");
  });
});
