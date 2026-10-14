"use client";

import { useCallback, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/browser-api";
import type { RecipeDetails } from "@ovenlovin/core";
import { isImageFile } from "@/lib/photo-import-review";
import { PhotoImportDialog } from "./PhotoImportDialog";

function PhotoPick({
  files,
  onAdd,
  onRemove,
  onRead,
}: {
  files: File[];
  onAdd: (next: File[]) => void;
  onRemove: (index: number) => void;
  onRead: () => void;
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
            <li key={`${file.name}-${file.size}-${file.lastModified}`}>
              <span>{file.name}</span>
              <button type="button" className="btn" onClick={() => onRemove(index)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <button
        className="btn primary import-submit"
        type="button"
        onClick={onRead}
        disabled={files.length === 0}
      >
        Read recipe
      </button>
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

  const addPhotos = useCallback((next: File[]) => {
    if (next.length === 0) return;
    setPhotoFiles((current) => [...current, ...next]);
    setError(null);
  }, []);

  const closePhoto = useCallback(() => setPhotoOpen(false), []);

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
    setPending(true);
    setError(null);
    try {
      const recipe = await api<RecipeDetails>("/api/v1/recipes/import", {
        method: "POST",
        body: JSON.stringify({ source, content }),
      });
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
          <PhotoPick
            files={photoFiles}
            onAdd={addPhotos}
            onRemove={(index) =>
              setPhotoFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))
            }
            onRead={() => setPhotoOpen(true)}
          />
        ) : (
          <div className="import-row">
            <div className="import-field">
              {source === "url" ? (
                <input
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                  placeholder="https://example.com/chocolate-chip-cookies"
                  required
                />
              ) : (
                <textarea
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                  placeholder={
                    "Weeknight tomato pasta\n\nIngredients\n- 12 oz pasta\n- 1 jar tomatoes\n\nSteps\nBoil pasta. Warm sauce. Combine."
                  }
                  required
                />
              )}
            </div>
            <button className="btn primary import-submit" type="submit" disabled={pending}>
              {pending ? "Importing…" : "Import"}
            </button>
          </div>
        )}
        {error ? <p className="muted import-error">{error}</p> : null}
      </form>
      <PhotoImportDialog open={photoOpen} files={photoFiles} onClose={closePhoto} />
    </>
  );
}
