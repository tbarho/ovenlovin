"use client";

import type { PhotoImportPreview } from "./photo-import";
import {
  extractPhotoPreviewFromFiles,
  photoImportErrorKind,
  photoImportErrorMessage,
  type PhotoImportErrorKind,
  type PhotoImportPhase,
} from "./photo-import-client";

export type PhotoImportJobSnapshot = {
  id: string;
  files: File[];
  previewUrl: string | null;
  phase: PhotoImportPhase;
  percent: number;
  readingStartedAt: number | null;
  errorKind: PhotoImportErrorKind | null;
  errorMessage: string | null;
  preview: PhotoImportPreview | null;
};

type Listener = (job: PhotoImportJobSnapshot | null) => void;

let job: PhotoImportJobSnapshot | null = null;
let abort: AbortController | null = null;
let objectUrl: string | null = null;
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener(job);
}

function revokePreview() {
  if (objectUrl && typeof URL.revokeObjectURL === "function") {
    URL.revokeObjectURL(objectUrl);
  }
  objectUrl = null;
}

function previewUrlFor(files: File[]): string | null {
  revokePreview();
  const file = files[0];
  if (!file) return null;
  objectUrl = URL.createObjectURL(file);
  return objectUrl;
}

function patch(next: Partial<PhotoImportJobSnapshot>) {
  if (!job) return;
  job = { ...job, ...next };
  emit();
}

function runExtract(files: File[]) {
  abort?.abort();
  const controller = new AbortController();
  abort = controller;
  void extractPhotoPreviewFromFiles(files, {
    signal: controller.signal,
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
      patch({
        phase: "error",
        errorKind: photoImportErrorKind(error),
        errorMessage: photoImportErrorMessage(error),
      });
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
    previewUrl: previewUrlFor(nextFiles),
    phase: "uploading",
    percent: 0,
    readingStartedAt: null,
    errorKind: null,
    errorMessage: null,
    preview: null,
  };
  emit();
  runExtract(nextFiles);
  return job;
}

export function retryPhotoImportJob(): PhotoImportJobSnapshot | null {
  if (!job || job.files.length === 0) return job;
  patch({
    phase: "uploading",
    percent: 0,
    readingStartedAt: null,
    errorKind: null,
    errorMessage: null,
    preview: null,
  });
  runExtract(job.files);
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
