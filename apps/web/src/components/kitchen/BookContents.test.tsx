import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { BookContentsView } from "@/lib/book-import-view";
import { BookContents, NO_CONTENTS_LINE, scannedNote } from "./BookContents";

const view = (map: BookContentsView["map"]): BookContentsView => ({
  jobId: "job-1",
  name: "Household 1 Suppers.pdf",
  pages: 12,
  status: "ready",
  error: null,
  map,
  picks: [],
  progress: { total: 0, done: 0, failed: 0 } as never,
  triage: {
    rows: [],
    summary: { total: 0, ready: 0, review: 0, pulling: 0, failed: 0, saved: 0 } as never,
    line: "",
  },
  cookbookId: null,
});

const emptyMap = {
  source: "none" as const,
  offset: 0,
  calibrated: false,
  mapPages: [],
  scannedPages: [1, 2, 3],
  candidates: [],
};

describe("BookContents with no candidates", () => {
  it("says the contents page was not found and leads into the paper path", async () => {
    render(<BookContents initial={view(emptyMap)} />);
    expect(screen.getByRole("status")).toHaveTextContent(NO_CONTENTS_LINE);
    expect(screen.queryByText(/when we pull the recipes/i)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Photograph the contents" }));
    expect(screen.getByRole("dialog", { name: "Add a paper cookbook" })).toBeVisible();
    expect(screen.getByLabelText("Book title")).toHaveValue("Household 1 Suppers");
  });
});

describe("scannedNote", () => {
  it("only promises a read for recipes picked on a scan", () => {
    expect(scannedNote(0)).toBeNull();
    expect(scannedNote(1)).toBe(
      "1 page is a scan. A recipe you pick on it is read from the page image."
    );
    expect(scannedNote(3)).toBe(
      "3 pages are scans. Recipes you pick on them are read from the page images."
    );
  });
});
