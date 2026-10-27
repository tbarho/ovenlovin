import { afterEach, describe, expect, it, vi } from "vitest";

const extract = vi.hoisted(() => ({
  options: null as any,
  resolve: null as any,
  reject: null as any,
}));

vi.mock("./photo-import-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./photo-import-client")>()),
  extractPhotoPreviewFromFiles: vi.fn((_files: File[], options: any) => {
    extract.options = options;
    return new Promise((resolve, reject) => {
      extract.resolve = resolve;
      extract.reject = reject;
    });
  }),
}));

import {
  PHOTO_IMPORT_BLURRY_MESSAGE,
  PHOTO_IMPORT_STILL_BLURRY,
  shouldOfferSharperRead,
} from "./photo-import-client";
import {
  cancelPhotoImportJob,
  getPhotoImportJob,
  retryPhotoImportJob,
  startPhotoImportJob,
} from "./photo-import-job";

describe("photo import job", () => {
  afterEach(() => {
    cancelPhotoImportJob();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("stamps readingStartedAt without forcing percent to 100", () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    vi.stubGlobal("URL", { ...URL, createObjectURL: () => "blob:x", revokeObjectURL: vi.fn() });
    startPhotoImportJob([new File(["card"], "card.jpg", { type: "image/jpeg" })]);
    expect(getPhotoImportJob()).toMatchObject({ phase: "uploading", readingStartedAt: null });
    extract.options.onUploadProgress(64);
    extract.options.onPhase("reading");
    expect(getPhotoImportJob()).toMatchObject({
      phase: "reading",
      percent: 64,
      readingStartedAt: 1_000_000,
    });
    retryPhotoImportJob();
    expect(getPhotoImportJob()).toMatchObject({ phase: "uploading", readingStartedAt: null });
  });

  it("keeps one preview URL per page and revokes them all", () => {
    const revoke = vi.fn();
    let n = 0;
    vi.stubGlobal("URL", { ...URL, createObjectURL: () => `blob:${++n}`, revokeObjectURL: revoke });
    startPhotoImportJob([
      new File(["a"], "a.jpg", { type: "image/jpeg" }),
      new File(["b"], "b.jpg", { type: "image/jpeg" }),
    ]);
    expect(getPhotoImportJob()?.previewUrls).toEqual(["blob:1", "blob:2"]);
    cancelPhotoImportJob();
    expect(revoke).toHaveBeenCalledWith("blob:1");
    expect(revoke).toHaveBeenCalledWith("blob:2");
  });

  it("words errors for a set of pages", async () => {
    vi.stubGlobal("URL", { ...URL, createObjectURL: () => "blob:x", revokeObjectURL: vi.fn() });
    startPhotoImportJob([
      new File(["a"], "a.jpg", { type: "image/jpeg" }),
      new File(["b"], "b.jpg", { type: "image/jpeg" }),
    ]);
    extract.reject(new Error("This photo is too blurry to read."));
    await vi.waitFor(() => expect(getPhotoImportJob()?.phase).toBe("error"));
    expect(getPhotoImportJob()?.errorMessage).toBe(
      "These pages are hard to read. Try a sharper read, or retake it in good light."
    );
  });

  it("runs one sharper read on the same pages and stops there", async () => {
    vi.stubGlobal("URL", { ...URL, createObjectURL: () => "blob:x", revokeObjectURL: vi.fn() });
    const files = [new File(["a"], "a.jpg", { type: "image/jpeg" })];
    startPhotoImportJob(files);
    expect(extract.options.enhanced).toBe(false);
    extract.reject(new Error(PHOTO_IMPORT_BLURRY_MESSAGE));
    await vi.waitFor(() => expect(getPhotoImportJob()?.errorKind).toBe("blurry"));
    retryPhotoImportJob({ enhanced: true });
    expect(extract.options.enhanced).toBe(true);
    expect(getPhotoImportJob()).toMatchObject({ phase: "uploading", enhanced: true });
    expect(getPhotoImportJob()?.files).toEqual(files);
    extract.reject(new Error(PHOTO_IMPORT_BLURRY_MESSAGE));
    await vi.waitFor(() => expect(getPhotoImportJob()?.phase).toBe("error"));
    expect(getPhotoImportJob()?.errorMessage).toBe(PHOTO_IMPORT_STILL_BLURRY);
    expect(shouldOfferSharperRead(getPhotoImportJob()!)).toBe(false);
  });

  it("returns to the first read when a sharper read from review fails", async () => {
    vi.stubGlobal("URL", { ...URL, createObjectURL: () => "blob:x", revokeObjectURL: vi.fn() });
    startPhotoImportJob([new File(["a"], "a.jpg", { type: "image/jpeg" })]);
    const first = { title: "Card", uncertainFields: ["steps"] };
    extract.resolve(first);
    await vi.waitFor(() => expect(getPhotoImportJob()?.phase).toBe("review"));
    retryPhotoImportJob({ enhanced: true });
    extract.reject(new Error(PHOTO_IMPORT_BLURRY_MESSAGE));
    await vi.waitFor(() => expect(getPhotoImportJob()?.phase).toBe("review"));
    expect(getPhotoImportJob()).toMatchObject({
      preview: first,
      notice: PHOTO_IMPORT_STILL_BLURRY,
      enhanced: true,
    });
  });
});
