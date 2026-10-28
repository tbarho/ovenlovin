import { describe, expect, it, vi } from "vitest";

vi.mock("@ovenlovin/db", () => ({ getDatabase: () => ({}) }));

import { saveBookRecipes } from "./book-save";

const HOUSEHOLD = "22222222-2222-4222-8222-222222222222";
const JOB = "33333333-3333-4333-8333-333333333333";
const HERO = "https://store.public.blob.vercel-storage.com/recipes/h/book/j/lemon.png";

const span = (candidateId: string, title: string, pageStart: number, printedPage: number) => ({
  step: "recipe",
  candidateId,
  title,
  group: "Baking",
  printedPage,
  pageStart,
  pageEnd: pageStart,
  nextTitle: null,
  nextGroup: null,
});

const draft = (id: string, title: string, overrides: Record<string, unknown> = {}) => ({
  title,
  ingredients: [{ rawText: "1 cup flour" }],
  steps: [{ text: "Bake." }],
  images: [],
  overallConfidence: 0.95,
  needsReview: false,
  uncertainFields: [],
  source: {
    type: "pdf",
    bookTitle: "A Synthetic Kitchen",
    author: "Author A",
    attribution: "A Synthetic Kitchen, p. 1",
    importerName: "pdf-importer",
    importerVersion: "0.1.0",
    rawExtractionJson: { candidateId: id, photoFingerprint: `pdf:sha:${id}` },
  },
  ...overrides,
});

const done = (payload: any, d: any) => ({
  status: "done",
  payload,
  result: { candidateId: payload.candidateId, route: "text", draft: d, duplicate: null },
});

function setup() {
  const saved: Record<string, string> = {};
  const input: Record<string, unknown> = {
    name: "A Synthetic Kitchen.pdf",
    pages: 6,
    sha256: "sha",
    blobUrl: "https://store.public.blob.vercel-storage.com/books/h/sha.pdf",
  };
  // Stored out of book order on purpose: triage sorts by page.
  const items = [
    { status: "failed", payload: span("ginger", "Ginger Snaps", 6, 3), error: "Not found." },
    done(
      span("short", "Shortbread", 5, 2),
      draft("short", "Shortbread", { overallConfidence: 0.3 })
    ),
    done(span("lemon", "Lemon Bars", 4, 1), draft("lemon", "Lemon Bars", { images: [HERO] })),
  ];
  const queue: any = {
    get: vi.fn(async () => ({ id: JOB, householdId: HOUSEHOLD, kind: "book_import", input })),
    items: vi.fn(async () => items),
    patchInput: vi.fn(async (_id: string, patch: Record<string, unknown>) => {
      Object.assign(input, patch);
    }),
  };
  const book: any = { id: "cookbook-1", householdId: HOUSEHOLD, bookSettings: null };
  const cookbooks: any = {
    getCookbook: vi.fn(async (id: string) => (id === book.id ? book : null)),
    createCookbook: vi.fn(async (data: any) => Object.assign(book, data)),
    updateCookbook: vi.fn(async (_id: string, data: any) => Object.assign(book, data)),
    addRecipe: vi.fn(async () => true),
  };
  const recipes: any = {
    listBookImportRecipeIds: vi.fn(async () => ({ ...saved })),
    persistImportedDraft: vi.fn(async (d: any) => {
      const candidateId = d.source.rawExtractionJson.candidateId;
      const id = `recipe-${candidateId}`;
      saved[candidateId] = id;
      return { outcome: "created", recipe: { id, title: d.title, images: d.images ?? [] } };
    }),
  };
  const save = (entries: any[]) =>
    saveBookRecipes(queue, JOB, { householdId: HOUSEHOLD, createdBy: "user-1" }, entries, {
      recipes,
      cookbooks,
    });
  return { queue, cookbooks, recipes, save, input };
}

describe("saveBookRecipes", () => {
  it("creates the cookbook from the book and files Ready recipes at their book position", async () => {
    const { save, cookbooks, recipes, input } = setup();
    const result = await save([{ candidateId: "lemon" }, { candidateId: "short" }]);

    expect(result).toEqual({
      cookbookId: "cookbook-1",
      saved: [{ candidateId: "lemon", recipeId: "recipe-lemon" }],
    });
    expect(cookbooks.createCookbook).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "A Synthetic Kitchen",
        description: "By Author A",
        bookSettings: { title: "A Synthetic Kitchen", subtitle: "Author A" },
      })
    );
    expect(input.cookbookId).toBe("cookbook-1");
    expect(cookbooks.addRecipe).toHaveBeenCalledWith("cookbook-1", "recipe-lemon", 0);
    // Shortbread needs a look: bulk accept skips it.
    expect(recipes.persistImportedDraft).toHaveBeenCalledTimes(1);
    expect(recipes.persistImportedDraft.mock.calls[0][0].source.rawExtractionJson.bookPage).toBe(1);
    expect(cookbooks.updateCookbook).toHaveBeenCalledWith("cookbook-1", {
      bookSettings: expect.objectContaining({
        cover: { kind: "recipe", recipeId: "recipe-lemon" },
      }),
    });
  });

  it("saves a fixed recipe into the same cookbook in book order, with the server's source", async () => {
    const { save, cookbooks, recipes } = setup();
    await save([{ candidateId: "lemon" }]);
    await save([
      {
        candidateId: "ginger",
        reviewed: {
          title: "Ginger Snaps",
          ingredients: [{ rawText: "2 cups flour" }],
          steps: [{ text: "Bake." }],
          images: ["https://evil.example/x.png"],
          source: { type: "url", importerName: "x", rawExtractionJson: {} },
        },
      },
      {
        candidateId: "short",
        reviewed: {
          title: "Shortbread",
          ingredients: [{ rawText: "1 cup butter" }],
          steps: [{ text: "Bake." }],
        },
      },
    ]);

    expect(cookbooks.createCookbook).toHaveBeenCalledTimes(1);
    expect(cookbooks.addRecipe.mock.calls).toEqual([
      ["cookbook-1", "recipe-lemon", 0],
      ["cookbook-1", "recipe-short", 1],
      ["cookbook-1", "recipe-ginger", 2],
    ]);
    const ginger = recipes.persistImportedDraft.mock.calls.find(
      ([d]: any) => d.title === "Ginger Snaps"
    )[0];
    expect(ginger.images).toEqual([]);
    expect(ginger.source).toMatchObject({
      type: "pdf",
      bookTitle: "A Synthetic Kitchen",
      pageStart: 6,
      rawExtractionJson: { candidateId: "ginger", photoFingerprint: "pdf:sha:ginger", bookPage: 3 },
    });
  });

  it("skips recipes already saved", async () => {
    const { save, recipes } = setup();
    await save([{ candidateId: "lemon" }]);
    const again = await save([{ candidateId: "lemon" }]);
    expect(again?.saved).toEqual([]);
    expect(recipes.persistImportedDraft).toHaveBeenCalledTimes(1);
  });
});
