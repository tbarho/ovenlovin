import { describe, expect, it } from "vitest";
import {
  lookReasons,
  READY_CONFIDENCE,
  triageLine,
  triageRows,
  triageSummary,
} from "./book-triage";

const span = (
  candidateId: string,
  title: string,
  pageStart: number,
  printedPage: number | null
) => ({
  step: "recipe",
  candidateId,
  title,
  group: null,
  printedPage,
  pageStart,
  pageEnd: pageStart,
  nextTitle: null,
  nextGroup: null,
});

const draft = (overrides: Record<string, unknown> = {}) => ({
  title: "Lemon Bars",
  ingredients: [{ rawText: "1 cup flour" }],
  steps: [{ text: "Bake." }],
  overallConfidence: 0.95,
  needsReview: false,
  uncertainFields: [],
  ...overrides,
});

const done = (payload: any, d: any, duplicate: any = null) => ({
  status: "done",
  payload,
  result: { candidateId: payload.candidateId, route: "text", draft: d, duplicate },
});

describe("lookReasons", () => {
  it("is empty for a confident, complete, new draft", () => {
    expect(lookReasons(draft())).toEqual([]);
  });

  it("flags low confidence even when the importer did not", () => {
    expect(lookReasons(draft({ overallConfidence: READY_CONFIDENCE - 0.01 }))).toEqual([
      "Parts were hard to read.",
    ]);
  });

  it("names uncertain fields instead of a vague note", () => {
    expect(lookReasons(draft({ needsReview: true, uncertainFields: ["servings"] }))).toEqual([
      "Check servings.",
    ]);
  });

  it("flags duplicates and missing parts", () => {
    expect(lookReasons(draft({ ingredients: [], steps: [] }), { title: "Lemon Squares" })).toEqual([
      "Might already be in your kitchen as Lemon Squares.",
      "No ingredients found.",
      "No steps found.",
    ]);
  });
});

describe("triageRows", () => {
  const lemon = span("lemon", "Lemon Bars", 4, 1);
  const short = span("short", "Shortbread", 5, 2);
  const ginger = span("ginger", "Ginger Snaps", 6, null);

  it("sorts into book order and classifies each item", () => {
    const rows = triageRows([
      { status: "failed", payload: ginger, error: "We could not find it." },
      done(short, draft({ title: "Shortbread", overallConfidence: 0.4 })),
      { status: "done", payload: { step: "contents" }, result: {} },
      done(lemon, draft()),
    ]);
    expect(rows.map((row) => [row.candidateId, row.order, row.state, row.page])).toEqual([
      ["lemon", 0, "ready", 1],
      ["short", 1, "needs_look", 2],
      ["ginger", 2, "needs_look", 6],
    ]);
    expect(rows[2]!.reasons).toEqual(["We could not find it."]);
    expect(rows[2]!.draft).toBeNull();
  });

  it("marks queued items as pulling and saved items as saved", () => {
    const rows = triageRows(
      [{ status: "running", payload: lemon }, done(short, draft({ title: "Shortbread" }))],
      { short: "recipe-1" }
    );
    expect(rows.map((row) => row.state)).toEqual(["pulling", "saved"]);
    expect(rows[1]!.recipeId).toBe("recipe-1");
  });
});

describe("triageLine", () => {
  const summary = (items: any[], saved = {}) => triageSummary(triageRows(items, saved));
  const lemon = span("lemon", "Lemon Bars", 4, 1);
  const short = span("short", "Shortbread", 5, 2);

  it("reads plainly at every stage", () => {
    expect(triageLine(summary([]))).toBe("Pick your recipes");
    expect(triageLine(summary([done(lemon, draft()), { status: "queued", payload: short }]))).toBe(
      "Reading 1 of 2"
    );
    expect(
      triageLine(summary([done(lemon, draft()), done(short, draft({ needsReview: true }))]))
    ).toBe("1 of 2 ready");
    expect(
      triageLine(
        summary([done(lemon, draft()), done(short, draft())], { lemon: "r1", short: "r2" })
      )
    ).toBe("2 of 2 saved");
  });
});
