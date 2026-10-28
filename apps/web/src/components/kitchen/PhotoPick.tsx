"use client";

import { useEffect, useId, useState } from "react";
import {
  PHOTO_IMPORT_MAX_PAGES,
  PHOTO_PICK_LEAD,
  addPhotoPages,
  movePhotoPage,
  photoPageLabel,
  photoPageLimitLabel,
} from "@/lib/photo-import-client";
import { isImageFile } from "@/lib/photo-import-review";

function PhotoTile({
  file,
  index,
  count,
  onMove,
  onRemove,
}: {
  file: File;
  index: number;
  count: number;
  onMove: (to: number) => void;
  onRemove: () => void;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const page = index + 1;

  useEffect(() => {
    if (typeof URL.createObjectURL === "function") {
      const url = URL.createObjectURL(file);
      setSrc(url);
      return () => {
        if (typeof URL.revokeObjectURL === "function") URL.revokeObjectURL(url);
      };
    }
    const reader = new FileReader();
    reader.onload = () => setSrc(String(reader.result));
    reader.readAsDataURL(file);
    return () => reader.abort();
  }, [file]);

  return (
    <li className="photo-page">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" />
      ) : (
        <span className="photo-thumb-fallback" aria-hidden="true" />
      )}
      <span className="photo-page-label">{photoPageLabel(index)}</span>
      <div className="photo-page-actions">
        {count > 1 ? (
          <>
            <button
              type="button"
              className="btn compact"
              aria-label={`Move page ${page} earlier`}
              disabled={index === 0}
              onClick={() => onMove(index - 1)}
            >
              <span aria-hidden="true">←</span>
            </button>
            <button
              type="button"
              className="btn compact"
              aria-label={`Move page ${page} later`}
              disabled={index === count - 1}
              onClick={() => onMove(index + 1)}
            >
              <span aria-hidden="true">→</span>
            </button>
          </>
        ) : null}
        <button
          type="button"
          className="btn compact"
          aria-label={`Remove page ${page}`}
          onClick={onRemove}
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>
    </li>
  );
}

function addedAnnouncement(before: number, after: number, asked: number): string {
  if (after === before) return `${photoPageLimitLabel()}.`;
  const added =
    after - before === 1 ? `Page ${after} added.` : `Pages ${before + 1} to ${after} added.`;
  return asked > after - before ? `${added} ${photoPageLimitLabel()}.` : added;
}

export function PhotoPick({
  files,
  onChange,
}: {
  files: File[];
  onChange: (next: File[]) => void;
}) {
  const cameraId = useId();
  const libraryId = useId();
  const [over, setOver] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const full = files.length >= PHOTO_IMPORT_MAX_PAGES;

  function takeFiles(list: FileList | null) {
    const picked = Array.from(list ?? []).filter(isImageFile);
    if (picked.length === 0) return;
    const next = addPhotoPages(files, picked);
    setAnnouncement(addedAnnouncement(files.length, next.length, picked.length));
    onChange(next);
  }

  function move(from: number, to: number) {
    setAnnouncement(`Page ${from + 1} moved to ${to + 1}.`);
    onChange(movePhotoPage(files, from, to));
  }

  function remove(index: number) {
    setAnnouncement(`Page ${index + 1} removed.`);
    onChange(files.filter((_, itemIndex) => itemIndex !== index));
  }

  return (
    <div className="photo-pick">
      <div
        className={`photo-drop${over ? " is-over" : ""}`}
        onDragEnter={(event) => {
          event.preventDefault();
          setOver(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setOver(false);
          takeFiles(event.dataTransfer.files);
        }}
      >
        <p>{PHOTO_PICK_LEAD}</p>
        {files.length === 0 ? (
          <div className="photo-pick-actions">
            <label className="btn" htmlFor={cameraId}>
              Take photo
            </label>
            <label className="btn" htmlFor={libraryId}>
              Choose photos
            </label>
          </div>
        ) : null}
        <input
          id={cameraId}
          className="photo-file-input"
          type="file"
          accept="image/*"
          capture="environment"
          disabled={full}
          onChange={(event) => {
            takeFiles(event.target.files);
            event.target.value = "";
          }}
        />
        <input
          id={libraryId}
          className="photo-file-input"
          type="file"
          accept="image/*"
          multiple
          disabled={full}
          onChange={(event) => {
            takeFiles(event.target.files);
            event.target.value = "";
          }}
        />
      </div>
      {files.length > 0 ? (
        <ol className="photo-pages">
          {files.map((file, index) => (
            <PhotoTile
              key={`${file.name}-${file.size}-${file.lastModified}`}
              file={file}
              index={index}
              count={files.length}
              onMove={(to) => move(index, to)}
              onRemove={() => remove(index)}
            />
          ))}
          <li className="photo-page photo-page-add">
            {full ? (
              <span className="photo-page-add-target" aria-disabled="true">
                {photoPageLimitLabel()}
              </span>
            ) : (
              <label className="photo-page-add-target" htmlFor={cameraId}>
                <span aria-hidden="true">+</span> Add page
              </label>
            )}
          </li>
        </ol>
      ) : null}
      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}
