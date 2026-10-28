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

/** A paper book: the map is on the input, rows are shots, saves carry review edits. */
function setupShot() {
  const saved: Record<string, string> = {};
  const input: Record<string, unknown> = {
    name: "A Paper Pantry",
    sha256: "papersha",
    blobUrl: "",
    pages: 0,
    verified: true,
    source: "photos",
    photoMap: {
      source: "contents",
      offset: 0,
      calibrated: true,
      mapPages: [],
      scannedPages: [],
      candidates: [
        { id: "ribs", title: "Short ribs", group: null, printedPage: 112, pdfPage: null },
        { id: "corn", title: "Corn bread", group: null, printedPage: 140, pdfPage: null },
      ],
    },
    picks: ["ribs", "corn"],
    shooting: true,
  };
  const queue: any = {
    get: vi.fn(async () => ({ id: JOB, householdId: HOUSEHOLD, kind: "book_import", input })),
    items: vi.fn(async () => []),
    patchInput: vi.fn(async (_id: string, patch: Record<string, unknown>) => {
      Object.assign(input, patch);
    }),
  };
  const book: any = { id: "cookbook-shot", householdId: HOUSEHOLD, bookSettings: null };
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
      return { outcome: "created", recipe: { id, title: d.title, images: d.images ?? [] } } as any;
    }),
  };
  const save = (entries: any[]) =>
    saveBookRecipes(queue, JOB, { householdId: HOUSEHOLD, createdBy: "user-1" }, entries, {
      recipes,
      cookbooks,
    });
  return { queue, cookbooks, recipes, save, input };
}

describe("saveBookRecipes (paper book)", () => {
  it("files a reviewed page-photo recipe into a cookbook named for the book, with its page", async () => {
    const { save, cookbooks, recipes } = setupShot();
    const result = await save([
      {
        candidateId: "ribs",
        reviewed: {
          title: "Short ribs",
          ingredients: [{ rawText: "2 lb short ribs" }],
          steps: [{ text: "Braise." }],
          images: [],
          source: {
            type: "photo",
            importerName: "photo-importer",
            importerVersion: "0.1.0",
            rawExtractionJson: {},
          },
        },
      },
    ]);

    expect(result?.saved).toEqual([{ candidateId: "ribs", recipeId: "recipe-ribs" }]);
    expect(cookbooks.createCookbook).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "A Paper Pantry",
        description: null,
        bookSettings: { title: "A Paper Pantry" },
      })
    );
    const draft: any = recipes.persistImportedDraft.mock.calls[0][0];
    expect(draft.source).toMatchObject({
      type: "pdf",
      bookTitle: "A Paper Pantry",
      attribution: "A Paper Pantry, p. 112",
      importerName: "photo-importer",
      rawExtractionJson: {
        candidateId: "ribs",
        bookPage: 112,
        photoFingerprint: "pdf:papersha:ribs",
      },
    });
    expect(cookbooks.addRecipe).toHaveBeenCalledWith("cookbook-shot", "recipe-ribs", 0);
  });

  it("skips shots without review edits and saved rows", async () => {
    const { save, recipes } = setupShot();
    const none = await save([{ candidateId: "ribs" }]);
    expect(none?.saved).toEqual([]);
    expect(recipes.persistImportedDraft).not.toHaveBeenCalled();

    await save([
      {
        candidateId: "ribs",
        reviewed: {
          title: "Short ribs",
          ingredients: [{ rawText: "2 lb short ribs" }],
          steps: [{ text: "Braise." }],
          source: {
            type: "photo",
            importerName: "photo-importer",
            importerVersion: "0.1.0",
            rawExtractionJson: {},
          },
        },
      },
    ]);
    const again = await save([
      {
        candidateId: "ribs",
        reviewed: {
          title: "Short ribs",
          ingredients: [{ rawText: "2 lb short ribs" }],
          steps: [{ text: "Braise." }],
          source: {
            type: "photo",
            importerName: "photo-importer",
            importerVersion: "0.1.0",
            rawExtractionJson: {},
          },
        },
      },
    ]);
    expect(again?.saved).toEqual([]);
    expect(recipes.persistImportedDraft).toHaveBeenCalledTimes(1);
  });
});
