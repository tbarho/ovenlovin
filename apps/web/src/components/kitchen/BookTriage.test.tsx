import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TriageRow } from "@ovenlovin/core/jobs";
import { api } from "@/lib/browser-api";
import type { BookContentsView } from "@/lib/book-import-view";
import { BookTriage, triageReviewDraft } from "./BookTriage";

function row(
  overrides: Partial<TriageRow> & Pick<TriageRow, "candidateId" | "title" | "state">
): TriageRow {
  return {
    page: 1,
    pageStart: 1,
    pageEnd: 1,
    order: 0,
    reasons: [],
    draft: null,
    duplicate: null,
    recipeId: null,
    ...overrides,
  };
}

function view(rows: TriageRow[], cookbookId: string | null = "cb-1"): BookContentsView {
  const summary = {
    total: rows.length,
    ready: rows.filter((item) => item.state === "ready").length,
    needsLook: rows.filter((item) => item.state === "needs_look").length,
    pulling: rows.filter((item) => item.state === "pulling").length,
    saved: rows.filter((item) => item.state === "saved").length,
  };
  return {
    jobId: "job-1",
    name: "Household 1 Suppers.pdf",
    pages: 12,
    status: "ready",
    error: null,
    map: null,
    picks: [],
    progress: { total: rows.length, done: rows.length, failed: 0 },
    triage: {
      rows,
      summary,
      line: `${summary.ready + summary.saved} of ${summary.total} ready`,
    },
    cookbookId,
  };
}

const readyRow = row({
  candidateId: "cand-ready",
  title: "Lemon Bars",
  state: "ready",
  page: 1,
});

const flaggedDraft = {
  title: "Shortbread",
  servings: 8,
  ingredients: [{ rawText: "2 cups flour" }],
  steps: [{ text: "Bake until golden." }],
  source: { type: "pdf" as const, importerName: "pdf-importer", importerVersion: "0.1.0" },
};

const flaggedRow = row({
  candidateId: "cand-look",
  title: "Shortbread",
  state: "needs_look",
  page: 2,
  reasons: ["Check servings."],
  draft: flaggedDraft,
});

const failedRow = row({
  candidateId: "cand-fail",
  title: "Ginger Snaps",
  state: "needs_look",
  page: 3,
  reasons: ['Could not find "Ginger Snaps".'],
});

const savedRow = row({
  candidateId: "cand-saved",
  title: "Tomato Soup",
  state: "saved",
  page: 4,
  recipeId: "rec-soup",
});

describe("triageReviewDraft", () => {
  it("uses the parked draft when the read finished", () => {
    const draft = triageReviewDraft(flaggedRow);
    expect(draft.title).toBe("Shortbread");
    expect(draft.servings).toBe("8");
    expect(draft.ingredientsText).toBe("2 cups flour");
    expect(draft.stepsText).toBe("Bake until golden.");
    expect(draft.source.type).toBe("pdf");
  });

  it("keeps the title when the read failed", () => {
    const draft = triageReviewDraft(failedRow);
    expect(draft.title).toBe("Ginger Snaps");
    expect(draft.ingredientsText).toBe("");
    expect(draft.stepsText).toBe("");
    expect(draft.source.type).toBe("pdf");
  });
});

describe("BookTriage primitives", () => {
  it("uses a default Save Button, compact Review Buttons, and a ds-button cookbook Link", () => {
    render(<BookTriage view={view([readyRow, flaggedRow, savedRow])} onChange={() => {}} />);

    const save = screen.getByRole("button", { name: "Save 1 ready recipe" });
    expect(save).toHaveAttribute("data-slot", "button");
    expect(save).toHaveAttribute("data-variant", "default");
    expect(save).toHaveAttribute("data-size", "md");
    expect(save).not.toHaveClass("btn");

    const review = screen.getByRole("button", { name: "Review" });
    expect(review).toHaveAttribute("data-slot", "button");
    expect(review).toHaveAttribute("data-variant", "tertiary");
    expect(review).toHaveAttribute("data-size", "sm");
    expect(review).not.toHaveClass("btn");

    const cookbook = screen.getByRole("link", { name: "Open the cookbook" });
    expect(cookbook).toHaveAttribute("href", "/recipes?cookbook=cb-1");
    expect(cookbook).toHaveClass("ds-button", "ds-button--secondary", "ds-button--md");
    expect(cookbook).not.toHaveClass("btn");

    expect(screen.getByRole("link", { name: "Tomato Soup" })).toHaveAttribute(
      "href",
      "/recipes/rec-soup"
    );
    expect(document.querySelector(".book-triage .btn")).toBeNull();
  });
});

describe("BookTriage", () => {
  beforeEach(() => {
    vi.mocked(api).mockReset();
  });

  it("opens review from the parked draft and from a failed read", async () => {
    const user = userEvent.setup();
    render(<BookTriage view={view([flaggedRow, failedRow])} onChange={() => {}} />);

    const flagged = screen.getByText("Shortbread").closest("li");
    expect(flagged).not.toBeNull();
    await user.click(within(flagged!).getByRole("button", { name: "Review" }));

    const sheet = screen.getByRole("dialog", { name: "Review recipe" });
    expect(within(sheet).getByLabelText("Title")).toHaveValue("Shortbread");
    expect(within(sheet).getByLabelText("Servings")).toHaveValue(8);
    expect(within(sheet).getByRole("status")).toHaveTextContent("Check servings.");

    await user.click(within(sheet).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog", { name: "Review recipe" })).not.toBeInTheDocument();

    const failed = screen.getByText("Ginger Snaps").closest("li");
    expect(failed).not.toBeNull();
    await user.click(within(failed!).getByRole("button", { name: "Review" }));
    const retry = screen.getByRole("dialog", { name: "Review recipe" });
    expect(within(retry).getByLabelText("Title")).toHaveValue("Ginger Snaps");
    expect(within(retry).getByRole("status")).toHaveTextContent('Could not find "Ginger Snaps".');
  });

  it("saves ready recipes and keeps the cookbook href", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const next = view([savedRow, { ...readyRow, state: "saved", recipeId: "rec-bars" }]);
    vi.mocked(api).mockResolvedValue({ view: next });

    render(<BookTriage view={view([readyRow, savedRow])} onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: "Save 1 ready recipe" }));

    await waitFor(() => {
      expect(api).toHaveBeenCalledWith("/api/v1/books/imports/job-1/recipes", {
        method: "POST",
        keepalive: false,
        body: JSON.stringify({ items: [{ candidateId: "cand-ready" }] }),
      });
    });
    expect(onChange).toHaveBeenCalledWith(next);
    expect(screen.getByRole("link", { name: "Open the cookbook" })).toHaveAttribute(
      "href",
      "/recipes?cookbook=cb-1"
    );
  });

  it("keeps Save 1 ready recipe on the Button while pending", async () => {
    const user = userEvent.setup();
    let finish: (value: { view: BookContentsView }) => void = () => {};
    vi.mocked(api).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );

    render(<BookTriage view={view([readyRow])} onChange={() => {}} />);
    const save = screen.getByRole("button", { name: "Save 1 ready recipe" });
    await user.click(save);

    expect(save).toHaveAttribute("aria-busy", "true");
    expect(save.querySelector(".ds-button__spinner")).not.toBeNull();
    expect(save).toHaveTextContent("Save 1 ready recipe");
    expect(save).not.toHaveTextContent("Saving");

    finish({ view: view([{ ...readyRow, state: "saved", recipeId: "rec-bars" }]) });
    await waitFor(() => {
      expect(save).not.toHaveAttribute("aria-busy");
    });
  });
});
