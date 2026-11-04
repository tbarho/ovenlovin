import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TriageRow } from "@ovenlovin/core/jobs";
import { api } from "@/lib/browser-api";
import type { BookShotView } from "@/lib/book-shot-view";
import { PHOTO_IMPORT_SHARPER } from "@/lib/photo-import-client";
import type { PhotoImportPreview } from "@/lib/photo-import";
import { BookShotList } from "./BookShotList";

const extract = vi.hoisted(() => vi.fn());

vi.mock("@/lib/photo-import-client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/photo-import-client")>(
    "@/lib/photo-import-client"
  );
  return { ...actual, extractPhotoPreviewFromFiles: extract };
});

const path = "/api/v1/books/imports/job-1";

const map = {
  source: "contents" as const,
  offset: 0,
  calibrated: true,
  mapPages: [1],
  scannedPages: [],
  candidates: [
    {
      id: "cand-ribs",
      title: "Short ribs",
      group: "Suppers",
      printedPage: 112,
      pdfPage: null,
    },
    {
      id: "cand-bread",
      title: "Corn bread",
      group: "Baking",
      printedPage: 140,
      pdfPage: null,
    },
  ],
};

function row(
  overrides: Partial<TriageRow> & Pick<TriageRow, "candidateId" | "title" | "state">
): TriageRow {
  return {
    page: 0,
    pageStart: 0,
    pageEnd: 0,
    order: 0,
    reasons: [],
    draft: null,
    duplicate: null,
    recipeId: null,
    ...overrides,
  };
}

function view(overrides: Partial<BookShotView> = {}): BookShotView {
  return {
    jobId: "job-1",
    name: "Household 1 Suppers.pdf",
    status: "ready",
    map,
    picks: [],
    shooting: false,
    triage: {
      rows: [],
      summary: { total: 0, ready: 0, needsLook: 0, pulling: 0, saved: 0 },
      line: "Pick your recipes",
    },
    cookbookId: null,
    ...overrides,
  };
}

const shootRow = row({
  candidateId: "cand-ribs",
  title: "Short ribs",
  state: "shoot",
  page: 112,
  pageStart: 112,
  pageEnd: 112,
});

const savedRow = row({
  candidateId: "cand-bread",
  title: "Corn bread",
  state: "saved",
  page: 140,
  pageStart: 140,
  pageEnd: 140,
  order: 1,
  recipeId: "rec-bread",
});

function shootingView(overrides: Partial<BookShotView> = {}): BookShotView {
  return view({
    shooting: true,
    picks: ["cand-ribs", "cand-bread"],
    cookbookId: "cb-1",
    triage: {
      rows: [shootRow, savedRow],
      summary: { total: 2, ready: 0, needsLook: 0, pulling: 0, saved: 1 },
      line: "1 of 2 photographed",
    },
    ...overrides,
  });
}

const preview: PhotoImportPreview = {
  title: "Short ribs",
  ingredients: [{ rawText: "2 pounds short ribs" }],
  steps: [{ text: "Braise until tender." }],
  images: [],
  source: {
    type: "photo",
    importerName: "photo-importer",
    importerVersion: "0.1.0",
    rawExtractionJson: {},
  },
  overallConfidence: 0.9,
  needsReview: false,
  reviewReasons: [],
  uncertainFields: [],
  allergenClassifications: [],
};

function libraryInput() {
  const input = document.querySelectorAll('input[type="file"]')[1];
  if (!(input instanceof HTMLInputElement)) throw new Error("photo library input missing");
  return input;
}

describe("BookShotList primitives", () => {
  it("uses secondary Select Buttons, a default shot-list Button, and a plain search field", () => {
    render(<BookShotList initial={view()} />);

    const selectAll = screen.getByRole("button", { name: "Select all" });
    expect(selectAll).toHaveAttribute("data-slot", "button");
    expect(selectAll).toHaveAttribute("data-variant", "secondary");
    expect(selectAll).toHaveAttribute("data-size", "md");
    expect(selectAll).not.toHaveClass("btn");

    const selectNone = screen.getByRole("button", { name: "Select none" });
    expect(selectNone).toHaveAttribute("data-slot", "button");
    expect(selectNone).toHaveAttribute("data-variant", "secondary");
    expect(selectNone).not.toHaveClass("btn");

    const make = screen.getByRole("button", { name: "Make a shot list for 0 recipes" });
    expect(make).toHaveAttribute("data-slot", "button");
    expect(make).toHaveAttribute("data-variant", "default");
    expect(make).toHaveAttribute("data-size", "md");
    expect(make).toBeDisabled();
    expect(make).not.toHaveClass("btn");

    const search = screen.getByLabelText("Search the contents");
    expect(search.tagName).toBe("INPUT");
    expect(search).not.toHaveAttribute("data-slot");

    const back = screen.getByRole("link", { name: "← Recipes" });
    expect(back).toHaveAttribute("href", "/recipes");
    expect(back).toHaveClass("back-link");
    expect(back).not.toHaveClass("ds-button");

    expect(document.querySelector(".book-contents .btn")).toBeNull();
  });

  it("uses a compact Photograph Button, a ds-button cookbook Link, and a plain recipe Link", () => {
    render(<BookShotList initial={shootingView()} />);

    const photograph = screen.getByRole("button", { name: "Photograph" });
    expect(photograph).toHaveAttribute("data-slot", "button");
    expect(photograph).toHaveAttribute("data-variant", "tertiary");
    expect(photograph).toHaveAttribute("data-size", "sm");
    expect(photograph).not.toHaveClass("btn");

    const cookbook = screen.getByRole("link", { name: "Open the cookbook" });
    expect(cookbook).toHaveAttribute("href", "/recipes?cookbook=cb-1");
    expect(cookbook).toHaveClass("ds-button", "ds-button--secondary", "ds-button--md");
    expect(cookbook).not.toHaveClass("btn");

    const recipe = screen.getByRole("link", { name: "Corn bread" });
    expect(recipe).toHaveAttribute("href", "/recipes/rec-bread");
    expect(recipe).not.toHaveClass("ds-button");
    expect(recipe).not.toHaveClass("btn");

    expect(screen.getByText("p. 112 Short ribs")).toBeVisible();
    expect(screen.getByText("p. 140")).toBeVisible();
    expect(document.querySelector(".book-contents .btn")).toBeNull();
  });
});

describe("BookShotList picks", () => {
  beforeEach(() => {
    vi.mocked(api).mockReset();
    vi.mocked(api).mockResolvedValue({});
  });

  it("saves select-all, select-none, and a single toggle", async () => {
    const user = userEvent.setup();
    render(<BookShotList initial={view()} />);

    expect(screen.getByText("0 of 2 recipes picked.")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Select all" }));
    await waitFor(() => {
      expect(api).toHaveBeenCalledWith(path, {
        method: "PATCH",
        body: JSON.stringify({ picks: ["cand-ribs", "cand-bread"] }),
      });
    });
    expect(screen.getByText("Saved")).toBeVisible();
    expect(screen.getByText("2 of 2 recipes picked.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Make a shot list for 2 recipes" })).toBeEnabled();

    await user.click(screen.getByRole("checkbox", { name: /Corn bread/ }));
    await waitFor(() => {
      expect(api).toHaveBeenCalledWith(path, {
        method: "PATCH",
        body: JSON.stringify({ picks: ["cand-ribs"] }),
      });
    });
    expect(screen.getByRole("checkbox", { name: /Corn bread/ })).not.toBeChecked();
    expect(screen.getByRole("button", { name: "Make a shot list for 1 recipe" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "Select none" }));
    await waitFor(() => {
      expect(api).toHaveBeenCalledWith(path, {
        method: "PATCH",
        body: JSON.stringify({ picks: [] }),
      });
    });
    expect(screen.getByText("0 of 2 recipes picked.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Make a shot list for 0 recipes" })).toBeDisabled();
  });

  it("says when no recipes match the search", async () => {
    const user = userEvent.setup();
    render(<BookShotList initial={view()} />);

    await user.type(screen.getByLabelText("Search the contents"), "no such recipe");
    expect(screen.getByText("No recipes match that search.")).toBeVisible();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("shows the pick error when the save fails", async () => {
    const user = userEvent.setup();
    vi.mocked(api).mockRejectedValueOnce(new Error("offline"));
    render(<BookShotList initial={view()} />);

    await user.click(screen.getByRole("button", { name: "Select all" }));
    expect(await screen.findByText("Could not save. Try again.")).toBeVisible();
    expect(screen.getByText("2 of 2 recipes picked.")).toBeVisible();
  });

  it("keeps the shot-list label while starting, then opens the shot list", async () => {
    const user = userEvent.setup();
    let finish: (value: unknown) => void = () => {};
    vi.mocked(api).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );

    render(<BookShotList initial={view({ picks: ["cand-ribs"] })} />);
    const make = screen.getByRole("button", { name: "Make a shot list for 1 recipe" });
    await user.click(make);

    expect(api).toHaveBeenCalledWith(path, { method: "POST" });
    expect(make).toHaveAttribute("aria-busy", "true");
    expect(make.querySelector(".ds-button__spinner")).not.toBeNull();
    expect(make).toHaveTextContent("Make a shot list for 1 recipe");
    expect(make).not.toHaveTextContent("Making");

    finish({ view: shootingView() });
    expect(await screen.findByRole("button", { name: "Photograph" })).toBeVisible();
    expect(screen.getByText("1 of 2 photographed.")).toBeVisible();
    expect(screen.queryByRole("button", { name: /Make a shot list/ })).not.toBeInTheDocument();
  });
});

describe("BookShotList shoot", () => {
  beforeEach(() => {
    vi.mocked(api).mockReset();
    extract.mockReset();
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: () => "blob:page",
      revokeObjectURL: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  async function openAndPickPage() {
    const user = userEvent.setup();
    render(<BookShotList initial={shootingView()} />);
    await user.click(screen.getByRole("button", { name: "Photograph" }));
    const sheet = screen.getByRole("dialog", { name: "Short ribs" });
    const read = within(sheet).getByRole("button", { name: "Read the page" });
    expect(read).toHaveAttribute("data-slot", "button");
    expect(read).toHaveAttribute("data-variant", "default");
    expect(read).toHaveAttribute("data-size", "md");
    expect(read).toBeDisabled();
    expect(read).not.toHaveClass("btn");

    await user.upload(libraryInput(), new File(["page"], "ribs.jpg", { type: "image/jpeg" }));
    expect(read).toBeEnabled();
    return { user, sheet, read };
  }

  it("opens the shoot sheet, ignores close while reading, and cancels from the sheet", async () => {
    extract.mockReturnValue(new Promise(() => {}));
    const { user, sheet, read } = await openAndPickPage();

    await user.click(read);
    expect(extract).toHaveBeenCalledWith(
      [expect.any(File)],
      expect.objectContaining({ enhanced: false })
    );
    expect(within(sheet).getByRole("progressbar", { name: "Upload" })).toBeVisible();

    const cancel = within(sheet).getByRole("button", { name: "Cancel" });
    expect(cancel).toHaveAttribute("data-variant", "tertiary");
    expect(cancel).toHaveAttribute("data-size", "sm");
    expect(cancel).not.toHaveClass("btn");

    await user.click(within(sheet).getByRole("button", { name: "Close" }));
    expect(screen.getByRole("dialog", { name: "Short ribs" })).toBeVisible();

    await user.click(cancel);
    expect(screen.queryByRole("dialog", { name: "Short ribs" })).not.toBeInTheDocument();
  });

  it("offers a small sharper read after a blurry page, then returns to picking", async () => {
    const user = userEvent.setup();
    extract.mockRejectedValueOnce(new Error("That photo is blurry"));
    render(<BookShotList initial={shootingView()} />);
    await user.click(screen.getByRole("button", { name: "Photograph" }));
    await user.upload(libraryInput(), new File(["page"], "ribs.jpg", { type: "image/jpeg" }));
    await user.click(screen.getByRole("button", { name: "Read the page" }));

    const sheet = await screen.findByRole("dialog", { name: "Short ribs" });
    expect(within(sheet).getByRole("status")).toHaveTextContent("That photo is blurry");

    const again = within(sheet).getByRole("button", { name: "Choose pages again" });
    expect(again).toHaveAttribute("data-variant", "tertiary");
    expect(again).toHaveAttribute("data-size", "sm");
    expect(again).not.toHaveClass("btn");

    const sharper = within(sheet).getByRole("button", { name: PHOTO_IMPORT_SHARPER });
    expect(sharper).toHaveAttribute("data-slot", "button");
    expect(sharper).toHaveAttribute("data-variant", "default");
    expect(sharper).toHaveAttribute("data-size", "sm");
    expect(sharper).not.toHaveClass("btn");
    expect(within(sheet).queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();

    await user.click(again);
    expect(within(sheet).getByRole("button", { name: "Read the page" })).toBeDisabled();

    extract.mockRejectedValueOnce(new Error("That photo is blurry"));
    await user.upload(libraryInput(), new File(["page"], "ribs.jpg", { type: "image/jpeg" }));
    await user.click(within(sheet).getByRole("button", { name: "Read the page" }));
    expect(await within(sheet).findByRole("button", { name: PHOTO_IMPORT_SHARPER })).toBeVisible();

    extract.mockReturnValue(new Promise(() => {}));
    await user.click(within(sheet).getByRole("button", { name: PHOTO_IMPORT_SHARPER }));
    expect(extract).toHaveBeenLastCalledWith(
      [expect.any(File)],
      expect.objectContaining({ enhanced: true })
    );
  });

  it("retries a failed read and saves the reviewed recipe", async () => {
    const user = userEvent.setup();
    extract.mockRejectedValueOnce(new Error("Could not read those pages"));
    const saved = shootingView({
      triage: {
        rows: [{ ...shootRow, state: "saved", recipeId: "rec-ribs" }, savedRow],
        summary: { total: 2, ready: 0, needsLook: 0, pulling: 0, saved: 2 },
        line: "2 of 2 saved",
      },
    });
    vi.mocked(api).mockResolvedValue({ view: saved });

    render(<BookShotList initial={shootingView()} />);
    await user.click(screen.getByRole("button", { name: "Photograph" }));
    await user.upload(libraryInput(), new File(["page"], "ribs.jpg", { type: "image/jpeg" }));
    await user.click(screen.getByRole("button", { name: "Read the page" }));

    const failed = await screen.findByRole("dialog", { name: "Short ribs" });
    const retry = within(failed).getByRole("button", { name: "Try again" });
    expect(retry).toHaveAttribute("data-variant", "default");
    expect(retry).toHaveAttribute("data-size", "sm");
    expect(retry).not.toHaveClass("btn");
    expect(
      within(failed).queryByRole("button", { name: PHOTO_IMPORT_SHARPER })
    ).not.toBeInTheDocument();

    extract.mockResolvedValueOnce(preview);
    await user.click(retry);

    const review = await screen.findByRole("dialog", { name: "Short ribs" });
    expect(within(review).getByLabelText("Title")).toHaveValue("Short ribs");
    expect(within(review).getByLabelText("Ingredients")).toHaveValue("2 pounds short ribs");

    await user.click(within(review).getByRole("button", { name: "Save recipe" }));

    await waitFor(() => {
      expect(api).toHaveBeenCalledWith(`${path}/recipes`, {
        method: "POST",
        keepalive: false,
        body: expect.any(String),
      });
    });
    const body = JSON.parse(String(vi.mocked(api).mock.calls[0]?.[1]?.body));
    expect(body.items).toEqual([
      expect.objectContaining({
        candidateId: "cand-ribs",
        reviewed: expect.objectContaining({
          title: "Short ribs",
          ingredients: [{ rawText: "2 pounds short ribs" }],
        }),
      }),
    ]);
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(screen.getByRole("link", { name: "Short ribs" })).toHaveAttribute(
      "href",
      "/recipes/rec-ribs"
    );
    expect(screen.queryByRole("button", { name: "Photograph" })).not.toBeInTheDocument();
  });
});
