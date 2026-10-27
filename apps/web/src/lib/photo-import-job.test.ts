import { afterEach, describe, expect, it, vi } from "vitest";

const extract = vi.hoisted(() => ({ options: null as any, resolve: null as any }));

vi.mock("./photo-import-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./photo-import-client")>()),
  extractPhotoPreviewFromFiles: vi.fn((_files: File[], options: any) => {
    extract.options = options;
    return new Promise((resolve) => {
      extract.resolve = resolve;
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
});
