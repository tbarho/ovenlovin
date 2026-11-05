import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/browser-api";
import type { BookContentsView } from "@/lib/book-import-view";
import { BookContents, NO_CONTENTS_LINE, scannedNote } from "./BookContents";

const view = (
  map: BookContentsView["map"],
  overrides: Partial<BookContentsView> = {}
): BookContentsView => ({
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
  ...overrides,
});

const emptyMap = {
  source: "none" as const,
  offset: 0,
  calibrated: false,
  mapPages: [],
  scannedPages: [1, 2, 3],
  candidates: [],
};

const candidateMap = {
  source: "contents" as const,
  offset: 0,
  calibrated: true,
  mapPages: [1],
  scannedPages: [2],
  candidates: [
    {
      id: "1-lemon-bars",
      title: "Lemon Bars",
      group: "Baking",
      printedPage: 1,
      pdfPage: 3,
    },
    {
      id: "1-shortbread",
      title: "Shortbread",
      group: "Baking",
      printedPage: 2,
      pdfPage: 4,
    },
    {
      id: "2-ginger-snaps",
      title: "Ginger Snaps",
      group: "Cookies",
      printedPage: 10,
      pdfPage: 12,
    },
  ],
};

const allIds = candidateMap.candidates.map((candidate) => candidate.id);
const path = "/api/v1/books/imports/job-1";

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

describe("BookContents primitives", () => {
  it("uses secondary Select Buttons, a default Pull Button, and Field + Input search", () => {
    render(<BookContents initial={view(candidateMap)} />);

    const selectAll = screen.getByRole("button", { name: "Select all" });
    expect(selectAll).toHaveAttribute("data-slot", "button");
    expect(selectAll).toHaveAttribute("data-variant", "secondary");
    expect(selectAll).not.toHaveClass("btn");

    const selectNone = screen.getByRole("button", { name: "Select none" });
    expect(selectNone).toHaveAttribute("data-slot", "button");
    expect(selectNone).toHaveAttribute("data-variant", "secondary");
    expect(selectNone).not.toHaveClass("btn");

    const pull = screen.getByRole("button", { name: "Pull 0 recipes" });
    expect(pull).toHaveAttribute("data-slot", "button");
    expect(pull).toHaveAttribute("data-variant", "default");
    expect(pull).toBeDisabled();
    expect(pull).not.toHaveClass("btn");

    const search = screen.getByLabelText("Search the contents");
    expect(search).toHaveAttribute("data-slot", "input");
    expect(search).toHaveAttribute("type", "search");
    expect(screen.getByText("Search the contents").closest("[data-slot='field']")).toHaveClass(
      "ds-field"
    );

    expect(screen.getByRole("checkbox", { name: /Lemon Bars/ })).toBeInTheDocument();
    expect(document.querySelector("[data-slot='checkbox']")).toBeNull();
    expect(document.querySelector(".book-contents .btn")).toBeNull();
  });
});

describe("BookContents picks", () => {
  beforeEach(() => {
    vi.mocked(api).mockReset();
    vi.mocked(api).mockResolvedValue({});
  });

  it("saves select-all, select-none, and a single toggle", async () => {
    const user = userEvent.setup();
    render(<BookContents initial={view(candidateMap)} />);

    expect(screen.getByText("0 of 3 recipes picked.")).toBeVisible();
    expect(
      screen.getByText("1 page is a scan. A recipe you pick on it is read from the page image.")
    ).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Select all" }));
    await waitFor(() => {
      expect(api).toHaveBeenCalledWith(path, {
        method: "PATCH",
        body: JSON.stringify({ picks: allIds }),
      });
    });
    expect(screen.getByText("3 of 3 recipes picked.")).toBeVisible();
    expect(screen.getByText("Saved")).toBeVisible();
    expect(screen.getByRole("checkbox", { name: /Lemon Bars/ })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /Shortbread/ })).toBeChecked();
    expect(screen.getByRole("button", { name: "Pull 3 recipes" })).toBeEnabled();

    await user.click(screen.getByRole("checkbox", { name: /Shortbread/ }));
    await waitFor(() => {
      expect(api).toHaveBeenCalledWith(path, {
        method: "PATCH",
        body: JSON.stringify({ picks: ["1-lemon-bars", "2-ginger-snaps"] }),
      });
    });
    expect(screen.getByText("2 of 3 recipes picked.")).toBeVisible();
    expect(screen.getByRole("checkbox", { name: /Shortbread/ })).not.toBeChecked();

    await user.click(screen.getByRole("button", { name: "Select none" }));
    await waitFor(() => {
      expect(api).toHaveBeenCalledWith(path, {
        method: "PATCH",
        body: JSON.stringify({ picks: [] }),
      });
    });
    expect(screen.getByText("0 of 3 recipes picked.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Pull 0 recipes" })).toBeDisabled();
  });

  it("filters the list from the search Input", async () => {
    const user = userEvent.setup();
    render(<BookContents initial={view(candidateMap)} />);

    await user.type(screen.getByLabelText("Search the contents"), "ginger");
    expect(screen.getByRole("checkbox")).toHaveAccessibleName(/Ginger Snaps/);
    expect(screen.queryByRole("checkbox", { name: /Lemon Bars/ })).not.toBeInTheDocument();

    await user.clear(screen.getByLabelText("Search the contents"));
    await user.type(screen.getByLabelText("Search the contents"), "no such recipe");
    expect(screen.getByText("No recipes match that search.")).toBeVisible();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("waits for the last save, then POSTs pull and keeps Pull N recipes while starting", async () => {
    const user = userEvent.setup();
    let finishSave: (value: unknown) => void = () => {};
    let finishPull: (value: unknown) => void = () => {};
    vi.mocked(api).mockImplementation((_url, init) => {
      if (init && typeof init === "object" && "method" in init && init.method === "PATCH") {
        return new Promise((resolve) => {
          finishSave = resolve;
        });
      }
      if (init && typeof init === "object" && "method" in init && init.method === "POST") {
        return new Promise((resolve) => {
          finishPull = resolve;
        });
      }
      return Promise.resolve(view(candidateMap, { picks: allIds }));
    });

    render(<BookContents initial={view(candidateMap)} />);
    await user.click(screen.getByRole("button", { name: "Select all" }));
    const pull = screen.getByRole("button", { name: "Pull 3 recipes" });
    await user.click(pull);

    expect(api).not.toHaveBeenCalledWith(path, { method: "POST" });
    expect(pull).toHaveAttribute("aria-busy", "true");
    expect(pull.querySelector(".ds-button__spinner")).not.toBeNull();
    expect(pull).toHaveTextContent("Pull 3 recipes");
    expect(pull).not.toHaveTextContent("Starting");

    finishSave({});
    await waitFor(() => {
      expect(api).toHaveBeenCalledWith(path, { method: "POST" });
    });

    finishPull({});
    await waitFor(() => {
      expect(api).toHaveBeenCalledTimes(3);
    });
    await waitFor(() => {
      expect(pull).not.toHaveAttribute("aria-busy");
    });
    expect(screen.getByText("3 of 3 recipes picked.")).toBeVisible();
  });
});
