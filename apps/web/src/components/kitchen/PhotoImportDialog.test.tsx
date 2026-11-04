import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PHOTO_IMPORT_TIMEOUT_MESSAGE } from "@/lib/photo-import-client";
import * as photoImportJob from "@/lib/photo-import-job";
import type { PhotoImportJobSnapshot } from "@/lib/photo-import-job";
import type { PhotoReviewDraft } from "@/lib/photo-import-review";
import { ImportReviewForm, PhotoImportDialog } from "./PhotoImportDialog";

const draft: PhotoReviewDraft = {
  title: "Sparse salad",
  notes: "",
  servings: "",
  prepTimeMinutes: "",
  cookTimeMinutes: "",
  sourceAttribution: "",
  ingredientsText: "   ",
  stepsText: "",
  images: [],
  uncertainFields: [],
  allergenLabels: [],
  source: {
    type: "photo",
    importerName: "photo-importer",
    importerVersion: "0.1.0",
    rawExtractionJson: {},
  },
};

describe("ImportReviewForm", () => {
  it("does not save when ingredients are only spaces", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(
      <ImportReviewForm
        draft={draft}
        heroSrc={null}
        pending={false}
        error={null}
        existingRecipeUrl={null}
        possibleDuplicate={null}
        savedRecipeId={null}
        showPhotoChrome={false}
        onOpenSaved={() => {}}
        onChange={() => {}}
        onSave={onSave}
      />
    );
    await user.click(screen.getByRole("button", { name: "Save recipe" }));
    expect(onSave).not.toHaveBeenCalled();
  });

  it("names the page count and kept photo for a multi-page review", () => {
    render(
      <ImportReviewForm
        draft={{ ...draft, ingredientsText: "1 cup flour" }}
        heroSrc={null}
        pending={false}
        error={null}
        existingRecipeUrl={null}
        possibleDuplicate={null}
        savedRecipeId={null}
        pages={3}
        onOpenSaved={() => {}}
        onChange={() => {}}
        onSave={() => {}}
      />
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Ready to review. Read from 3 pages. Page 1 is kept as the recipe photo."
    );
  });

  const base = {
    heroSrc: null,
    pending: false,
    error: null,
    existingRecipeUrl: null,
    possibleDuplicate: null,
    savedRecipeId: null,
    onOpenSaved: () => {},
    onChange: () => {},
    onSave: () => {},
  };

  it("offers a sharper read inline only when asked to", async () => {
    const user = userEvent.setup();
    const onSharperRead = vi.fn();
    const hard = { ...draft, ingredientsText: "1 cup flour", uncertainFields: ["steps"] };
    const { rerender } = render(
      <ImportReviewForm {...base} draft={hard} onSharperRead={onSharperRead} />
    );
    await user.click(screen.getByRole("button", { name: "Try a sharper read" }));
    expect(onSharperRead).toHaveBeenCalled();
    rerender(<ImportReviewForm {...base} draft={hard} />);
    expect(screen.queryByRole("button", { name: "Try a sharper read" })).toBeNull();
  });

  it("asks before replacing edits with the new read", async () => {
    const user = userEvent.setup();
    const onKeep = vi.fn();
    render(
      <ImportReviewForm
        {...base}
        draft={{ ...draft, ingredientsText: "1 cup flour" }}
        replacePrompt={{ onReplace: () => {}, onKeep }}
      />
    );
    expect(screen.getByText("Replace your edits with the new read?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Replace" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Keep mine" }));
    expect(onKeep).toHaveBeenCalled();
  });

  it("shows the still-hard-to-read notice in place of the warn line", () => {
    render(
      <ImportReviewForm
        {...base}
        draft={{ ...draft, ingredientsText: "1 cup flour", uncertainFields: ["steps"] }}
        notice="Still hard to read. Retake it closer, flat, in good light, or type it in."
        onSharperRead={undefined}
      />
    );
    expect(screen.getByRole("status")).toHaveTextContent("Still hard to read.");
    expect(screen.queryByRole("button", { name: "Try a sharper read" })).toBeNull();
  });
});

describe("ImportReviewForm primitives", () => {
  const props = {
    heroSrc: null,
    pending: false,
    error: null as string | null,
    existingRecipeUrl: null as string | null,
    possibleDuplicate: null,
    savedRecipeId: null as string | null,
    showPhotoChrome: false,
    onOpenSaved: () => {},
    onChange: () => {},
    onSave: () => {},
  };

  it("uses Field + Input/Textarea and default Save recipe Button", () => {
    render(
      <ImportReviewForm
        {...props}
        draft={{ ...draft, ingredientsText: "1 cup flour", uncertainFields: ["title"] }}
      />
    );

    const title = screen.getByLabelText("Title");
    expect(title).toHaveAttribute("data-slot", "input");
    expect(title.closest("[data-slot='field']")).toHaveClass("is-uncertain");
    expect(screen.getByText("This title was hard to read.")).toHaveAttribute("data-slot", "hint");

    expect(screen.getByLabelText("Servings")).toHaveAttribute("data-slot", "input");
    expect(screen.getByLabelText("Prep (min)")).toHaveAttribute("data-slot", "input");
    expect(screen.getByLabelText("Cook (min)")).toHaveAttribute("data-slot", "input");
    expect(screen.getByLabelText("Notes")).toHaveAttribute("data-slot", "textarea");
    expect(screen.getByLabelText("Source")).toHaveAttribute("data-slot", "input");
    expect(screen.getByLabelText("Ingredients")).toHaveAttribute("data-slot", "textarea");
    expect(screen.getByLabelText("Steps")).toHaveAttribute("data-slot", "textarea");

    const save = screen.getByRole("button", { name: "Save recipe" });
    expect(save).toHaveAttribute("data-slot", "button");
    expect(save).toHaveAttribute("data-variant", "default");
  });

  it("keeps replace, keep, and sharper-read actions on compact Buttons", () => {
    render(
      <ImportReviewForm
        {...props}
        draft={{ ...draft, ingredientsText: "1 cup flour", uncertainFields: ["steps"] }}
        replacePrompt={{ onReplace: () => {}, onKeep: () => {} }}
        onSharperRead={() => {}}
      />
    );

    const replace = screen.getByRole("button", { name: "Replace" });
    expect(replace).toHaveAttribute("data-slot", "button");
    expect(replace).toHaveAttribute("data-variant", "default");
    expect(replace).toHaveAttribute("data-size", "sm");

    const keep = screen.getByRole("button", { name: "Keep mine" });
    expect(keep).toHaveAttribute("data-variant", "tertiary");
    expect(keep).toHaveAttribute("data-size", "sm");

    const sharper = screen.getByRole("button", { name: "Try a sharper read" });
    expect(sharper).toHaveAttribute("data-variant", "tertiary");
    expect(sharper).toHaveAttribute("data-size", "sm");
  });

  it("shows save failures on Hint error and Open recipe as the default Button", () => {
    const { rerender } = render(
      <ImportReviewForm
        {...props}
        draft={{ ...draft, ingredientsText: "1 cup flour" }}
        error="Could not save recipe"
        existingRecipeUrl="/recipes/rec-1"
      />
    );

    const error = screen.getByText("Could not save recipe");
    expect(error).toHaveAttribute("data-slot", "hint");
    expect(error).toHaveClass("ds-hint--error");
    expect(screen.getByRole("link", { name: "Open that recipe" })).toHaveAttribute(
      "href",
      "/recipes/rec-1"
    );

    rerender(
      <ImportReviewForm
        {...props}
        draft={{ ...draft, ingredientsText: "1 cup flour" }}
        savedRecipeId="rec-1"
      />
    );
    const open = screen.getByRole("button", { name: "Open recipe" });
    expect(open).toHaveAttribute("data-slot", "button");
    expect(open).toHaveAttribute("data-variant", "default");
  });
});

function jobSnapshot(next: Partial<PhotoImportJobSnapshot> = {}): PhotoImportJobSnapshot {
  return {
    id: "job-1",
    files: [new File(["card"], "card.jpg", { type: "image/jpeg" })],
    previewUrls: [],
    phase: "uploading",
    percent: 32,
    readingStartedAt: null,
    enhanced: false,
    notice: null,
    errorKind: null,
    errorMessage: null,
    preview: null,
    ...next,
  };
}

describe("PhotoImportDialog primitives", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function emitJob(next: Partial<PhotoImportJobSnapshot> = {}) {
    vi.spyOn(photoImportJob, "subscribePhotoImportJob").mockImplementation((listener) => {
      listener(jobSnapshot(next));
      return () => {};
    });
  }

  it("uses tertiary Cancel while a photo job is uploading", () => {
    emitJob({ phase: "uploading", percent: 32 });
    render(<PhotoImportDialog open onClose={() => {}} onTypeOrPaste={() => {}} />);

    const dialog = screen.getByRole("dialog", { name: "Import from photo" });
    const cancel = within(dialog).getByRole("button", { name: "Cancel" });
    expect(cancel).toHaveAttribute("data-slot", "button");
    expect(cancel).toHaveAttribute("data-variant", "tertiary");
    expect(cancel).toHaveAttribute("data-size", "sm");
  });

  it("keeps Retry as the compact primary on a timeout error", () => {
    emitJob({
      phase: "error",
      errorKind: "timeout",
      errorMessage: PHOTO_IMPORT_TIMEOUT_MESSAGE,
    });
    render(<PhotoImportDialog open onClose={() => {}} onTypeOrPaste={() => {}} />);

    const retry = screen.getByRole("button", { name: "Retry" });
    expect(retry).toHaveAttribute("data-slot", "button");
    expect(retry).toHaveAttribute("data-variant", "default");
    expect(retry).toHaveAttribute("data-size", "sm");
    expect(screen.getByRole("button", { name: "Type or paste instead" })).toHaveAttribute(
      "data-variant",
      "tertiary"
    );
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveAttribute(
      "data-variant",
      "tertiary"
    );
  });
});
