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
});
