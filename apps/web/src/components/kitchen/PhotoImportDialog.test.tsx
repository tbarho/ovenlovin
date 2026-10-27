import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { PhotoReviewDraft } from "@/lib/photo-import-review";
import { ImportReviewForm } from "./PhotoImportDialog";

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
