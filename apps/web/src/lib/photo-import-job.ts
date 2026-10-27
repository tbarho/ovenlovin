"use client";

import type { PhotoImportPreview } from "./photo-import";
import {
  PHOTO_IMPORT_STILL_BLURRY,
  extractPhotoPreviewFromFiles,
  photoCopyForPages,
  photoImportErrorKind,
  photoImportErrorMessage,
  type PhotoImportErrorKind,
  type PhotoImportPhase,
} from "./photo-import-client";

export type PhotoImportJobSnapshot = {
  id: string;
  files: File[];
  previewUrls: string[];
  phase: PhotoImportPhase;
  percent: number;
  readingStartedAt: number | null;
  /** Last read was the sharper read; never offered again for this job. */
  enhanced: boolean;
  /** Set when a sharper read from review failed and the first read came back. */
  notice: string | null;
  errorKind: PhotoImportErrorKind | null;
  errorMessage: string | null;
  preview: PhotoImportPreview | null;
};

type Listener = (job: PhotoImportJobSnapshot | null) => void;

let job: PhotoImportJobSnapshot | null = null;
let abort: AbortController | null = null;
let objectUrls: string[] = [];
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener(job);
}

function revokePreview() {
  if (typeof URL.revokeObjectURL === "function") {
    for (const url of objectUrls) URL.revokeObjectURL(url);
  }
  objectUrls = [];
}

function previewUrlsFor(files: File[]): string[] {
  revokePreview();
  objectUrls = files.map((file) => URL.createObjectURL(file));
  return objectUrls;
}

function patch(next: Partial<PhotoImportJobSnapshot>) {
  if (!job) return;
  job = { ...job, ...next };
  emit();
}

function failureMessage(error: unknown, files: File[], enhanced: boolean): string {
  const kind = photoImportErrorKind(error);
  const message =
    enhanced && kind === "blurry" ? PHOTO_IMPORT_STILL_BLURRY : photoImportErrorMessage(error);
  return photoCopyForPages(message, files.length);
}

function runExtract(files: File[], enhanced: boolean, fallback: PhotoImportPreview | null) {
  abort?.abort();
  const controller = new AbortController();
  abort = controller;
  void extractPhotoPreviewFromFiles(files, {
    signal: controller.signal,
    enhanced,
    onPhase: (phase) => {
      if (controller.signal.aborted) return;
      if (phase === "reading") {
        patch({ phase, readingStartedAt: Date.now() });
        return;
      }
      patch({ phase, readingStartedAt: null });
    },
    onUploadProgress: (percent) => {
      if (controller.signal.aborted) return;
      patch({ phase: "uploading", percent });
    },
  })
    .then((preview) => {
      if (controller.signal.aborted) return;
      patch({ phase: "review", preview, errorKind: null, errorMessage: null });
    })
    .catch((error: unknown) => {
      if (controller.signal.aborted) return;
      const message = failureMessage(error, files, enhanced);
      if (fallback && photoImportErrorKind(error) !== "cancelled") {
        patch({ phase: "review", preview: fallback, notice: message });
        return;
      }
      patch({ phase: "error", errorKind: photoImportErrorKind(error), errorMessage: message });
    });
}

export function getPhotoImportJob(): PhotoImportJobSnapshot | null {
  return job;
}

export function subscribePhotoImportJob(listener: Listener): () => void {
  listeners.add(listener);
  listener(job);
  return () => {
    listeners.delete(listener);
  };
}

export function startPhotoImportJob(files: File[]): PhotoImportJobSnapshot {
  const nextFiles = files.slice();
  job = {
    id: `${Date.now()}-${nextFiles.map((file) => `${file.name}:${file.size}`).join("|")}`,
    files: nextFiles,
    previewUrls: previewUrlsFor(nextFiles),
    phase: "uploading",
    percent: 0,
    readingStartedAt: null,
    enhanced: false,
    notice: null,
    errorKind: null,
    errorMessage: null,
    preview: null,
  };
  emit();
  runExtract(nextFiles, false, null);
  return job;
}

/** `enhanced` re-reads the same original pages through the sharper-read path. */
export function retryPhotoImportJob(
  options: { enhanced?: boolean } = {}
): PhotoImportJobSnapshot | null {
  if (!job || job.files.length === 0) return job;
  const enhanced = Boolean(options.enhanced);
  const fallback = enhanced && job.phase === "review" ? job.preview : null;
  patch({
    phase: "uploading",
    percent: 0,
    readingStartedAt: null,
    enhanced,
    notice: null,
    errorKind: null,
    errorMessage: null,
    preview: null,
  });
  runExtract(job.files, enhanced, fallback);
  return job;
}

/** Stops the in-flight request so the server job can abort. */
export function cancelPhotoImportJob() {
  abort?.abort();
  abort = null;
  revokePreview();
  job = null;
  emit();
}

export function clearPhotoImportJobIfSettled() {
  if (!job || job.phase === "uploading" || job.phase === "reading") return;
  revokePreview();
  job = null;
  emit();
}
