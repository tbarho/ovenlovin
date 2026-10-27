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
    extract.reject(new Error("This photo is too blurry to read. Try a sharper shot."));
    await vi.waitFor(() => expect(getPhotoImportJob()?.phase).toBe("error"));
    expect(getPhotoImportJob()?.errorMessage).toBe(
      "These pages are too blurry to read. Try a sharper shot, or type or paste it."
    );
  });
});
