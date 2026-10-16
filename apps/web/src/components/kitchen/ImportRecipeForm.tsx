"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/browser-api";
import type { RecipeDetails } from "@ovenlovin/core";
import { importGuessedNotice, importInputError } from "@/lib/import-input";
import {
  PHOTO_IMPORT_ESTIMATE,
  PHOTO_IMPORT_IN_PROGRESS,
  photoImportAnnouncement,
} from "@/lib/photo-import-client";
import {
  cancelPhotoImportJob,
  startPhotoImportJob,
  subscribePhotoImportJob,
  type PhotoImportJobSnapshot,
} from "@/lib/photo-import-job";
import { isImageFile } from "@/lib/photo-import-review";
import { PhotoImportDialog } from "./PhotoImportDialog";

function PhotoThumb({ file, onRemove }: { file: File; onRemove: () => void }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSrc(url);
    return () => {
      if (typeof URL.revokeObjectURL === "function") URL.revokeObjectURL(url);
    };
  }, [file]);

  return (
    <li>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" />
      ) : (
        <span className="photo-thumb-fallback" aria-hidden="true" />
      )}
      <span>{file.name}</span>
      <button type="button" className="btn" onClick={onRemove}>
        Remove
      </button>
    </li>
  );
}

function PhotoPick({
  files,
  onAdd,
  onRemove,
}: {
  files: File[];
  onAdd: (next: File[]) => void;
  onRemove: (index: number) => void;
}) {
  const cameraId = useId();
  const libraryId = useId();
  const [over, setOver] = useState(false);

  function takeFiles(list: FileList | null) {
    if (!list) return;
    onAdd(Array.from(list).filter(isImageFile));
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
        <p>Drop a recipe card, cookbook page, or screenshot here.</p>
        <div className="photo-pick-actions">
          <label className="btn" htmlFor={cameraId}>
            Take photo
          </label>
          <label className="btn" htmlFor={libraryId}>
            Choose photos
          </label>
        </div>
        <input
          id={cameraId}
          className="photo-file-input"
          type="file"
          accept="image/*"
          capture="environment"
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
          onChange={(event) => {
            takeFiles(event.target.files);
            event.target.value = "";
          }}
        />
      </div>
      {files.length > 0 ? (
        <ul className="photo-thumbs">
          {files.map((file, index) => (
            <PhotoThumb
              key={`${file.name}-${file.size}-${file.lastModified}`}
              file={file}
              onRemove={() => onRemove(index)}
            />
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function ImportRecipeForm() {
  const router = useRouter();
  const [source, setSource] = useState<"url" | "paste" | "photo">("url");
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [photoJob, setPhotoJob] = useState<PhotoImportJobSnapshot | null>(null);
  const [imported, setImported] = useState<{
    id: string;
    notice: string;
  } | null>(null);
  const canSubmit = source === "photo" ? photoFiles.length > 0 : Boolean(content.trim());
  const jobBusy = photoJob?.phase === "uploading" || photoJob?.phase === "reading";

  useEffect(() => subscribePhotoImportJob(setPhotoJob), []);

  const addPhotos = useCallback((next: File[]) => {
    if (next.length === 0) return;
    setPhotoFiles((current) => {
      const files = [...current, ...next];
      startPhotoImportJob(files);
      return files;
    });
    setError(null);
    setPhotoOpen(true);
  }, []);

  const closePhoto = useCallback(() => setPhotoOpen(false), []);

  const typeOrPaste = useCallback(() => {
    cancelPhotoImportJob();
    setPhotoOpen(false);
    setSource("paste");
  }, []);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (source === "photo") {
      if (photoFiles.length === 0) {
        setError("Add a photo first");
        return;
      }
      setPhotoOpen(true);
      return;
    }
    const inputError = importInputError(source, content);
    if (inputError) {
      setError(inputError);
      return;
    }
    setPending(true);
    setError(null);
    try {
      const recipe = await api<RecipeDetails>("/api/v1/recipes/import", {
        method: "POST",
        body: JSON.stringify({ source, content }),
      });
      setImported({
        id: recipe.id,
        notice: importGuessedNotice(recipe.title, recipe.servings ?? null),
      });
      window.sessionStorage.setItem(
        "ovenlovin.import-toast",
        JSON.stringify({ title: recipe.title, servings: recipe.servings ?? 4 })
      );
      router.push(`/recipes/${recipe.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not import recipe");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <form className="form-card import-card" onSubmit={onSubmit}>
        <div className="import-toolbar">
          <h2>Import a recipe</h2>
          <div className="tabs import-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              className="tab"
              aria-selected={source === "url"}
              onClick={() => setSource("url")}
            >
              URL
            </button>
            <button
              type="button"
              role="tab"
              className="tab"
              aria-selected={source === "paste"}
              onClick={() => setSource("paste")}
            >
              Paste
            </button>
            <button
              type="button"
              role="tab"
              className="tab"
              aria-selected={source === "photo"}
              onClick={() => setSource("photo")}
            >
              Photo
            </button>
          </div>
        </div>
        {source === "photo" ? (
          <>
            <PhotoPick
              files={photoFiles}
              onAdd={addPhotos}
              onRemove={(index) =>
                setPhotoFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))
              }
            />
            {photoJob && jobBusy && !photoOpen ? (
              <div className="photo-import-banner">
                {photoJob.previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photoJob.previewUrl} alt="" />
                ) : (
                  <span className="photo-thumb-fallback" aria-hidden="true" />
                )}
                <div>
                  <strong>{PHOTO_IMPORT_IN_PROGRESS}</strong>
                  <p>{photoImportAnnouncement(photoJob.phase, photoJob.percent)}</p>
                  <p className="muted">{PHOTO_IMPORT_ESTIMATE}.</p>
                </div>
                <div className="photo-import-banner-actions">
                  <button type="button" className="btn compact" onClick={() => setPhotoOpen(true)}>
                    Open
                  </button>
                  <button
                    type="button"
                    className="btn compact"
                    onClick={() => cancelPhotoImportJob()}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <div className="import-row">
            <div className="import-field">
              {source === "url" ? (
                <input
                  value={content}
                  onChange={(event) => {
                    setContent(event.target.value);
                    setError(null);
                  }}
                  placeholder="https://example.com/chocolate-chip-cookies"
                  required
                />
              ) : (
                <textarea
                  value={content}
                  onChange={(event) => {
                    setContent(event.target.value);
                    setError(null);
                  }}
                  placeholder={
                    "Weeknight tomato pasta\n\nIngredients\n- 12 oz pasta\n- 1 jar tomatoes\n\nSteps\nBoil pasta. Warm sauce. Combine."
                  }
                  required
                />
              )}
            </div>
            <button
              className="btn primary import-submit"
              type="submit"
              disabled={pending || !canSubmit}
            >
              {pending ? "Importing…" : "Import"}
            </button>
          </div>
        )}
        {error ? <p className="muted import-error">{error}</p> : null}
        {imported ? (
          <p className="muted" data-testid="import-review">
            {imported.notice} · <a href={`/recipes/${imported.id}`}>Add to cookbook</a>
          </p>
        ) : null}
      </form>
      <PhotoImportDialog open={photoOpen} onClose={closePhoto} onTypeOrPaste={typeOrPaste} />
    </>
  );
}
