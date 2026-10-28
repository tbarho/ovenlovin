import { describe, expect, it, vi } from "vitest";

vi.mock("@ovenlovin/db", () => ({ getDatabase: () => ({}) }));

import { loadReaderBook, readerRecipe } from "./book-reader";

const HOUSEHOLD = "22222222-2222-4222-8222-222222222222";
const OTHER_HOUSEHOLD = "44444444-4444-4444-8444-444444444444";

const cookbook = (overrides: Record<string, unknown> = {}) => ({
  id: "00000000-0000-4000-8000-000000000020",
  householdId: HOUSEHOLD,
  name: "A Synthetic Kitchen",
  slug: "a-synthetic-kitchen",
  visibility: "private",
  sortOrder: 0,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  createdBy: "11111111-1111-4111-8111-111111111111",
  bookSettings: null,
  ...overrides,
});

const details = (id: string, title: string, overrides: Record<string, unknown> = {}) => ({
  id,
  title,
  householdId: HOUSEHOLD,
  description: null,
  familyStory: null,
  course: "Soups",
  servings: 4,
  yieldQuantity: null,
  yieldUnit: null,
  prepTimeMinutes: 10,
  cookTimeMinutes: 20,
  totalTimeMinutes: 30,
  images: [`https://store.public.blob.vercel-storage.com/recipes/${id}.png`],
  isFamilyRecipe: false,
  ingredients: [{ rawText: "1 cup flour", name: "flour" }],
  steps: [{ text: "Boil." }],
  ...overrides,
});

function setup(overrides: {
  book?: Record<string, unknown> | null;
  ids?: string[];
  byId?: Record<string, any>;
} = {}) {
  const book = overrides.book === undefined ? cookbook() : overrides.book;
  const ids = overrides.ids ?? ["r2", "r1"];
  const byId = overrides.byId ?? {
    r1: details("r1", "Lemon soup"),
    r2: details("r2", "Ginger stew"),
  };
  return {
    cookbooks: {
      getCookbook: vi.fn().mockResolvedValue(book),
      listRecipeIds: vi.fn().mockResolvedValue(ids),
    },
    recipes: {
      getRecipeDetails: vi.fn(async (id: string) => byId[id] ?? null),
    },
  };
}

describe("readerRecipe", () => {
  it("maps recipe details onto the paginate cookbook shape", () => {
    const mapped = readerRecipe(details("r1", "Lemon soup"));
    expect(mapped).toMatchObject({
      id: "r1",
      title: "Lemon soup",
      course: "Soups",
      servings: 4,
      images: ["https://store.public.blob.vercel-storage.com/recipes/r1.png"],
      ingredients: [{ rawText: "1 cup flour", name: "flour", group: null }],
      steps: [{ text: "Boil." }],
    });
  });

  it("defaults missing fields instead of passing undefined through", () => {
    const mapped = readerRecipe({ id: "r9", title: "Bare" });
    expect(mapped).toMatchObject({
      description: null,
      familyStory: null,
      images: [],
      isFamilyRecipe: false,
      sourcePhotos: [],
      ingredients: [],
      steps: [],
    });
  });
});

describe("loadReaderBook", () => {
  it("lays the book out in book order, not recipe detail order", async () => {
    const deps = setup({ ids: ["r2", "r1"] });
    const book = await loadReaderBook("00000000-0000-4000-8000-000000000020", HOUSEHOLD, deps);
    expect(book).not.toBeNull();
    const titles = book!.pages
      .flatMap((page: any) =>
        page.kind === "recipe"
          ? page.blocks.find((block: any) => block.type === "header")?.title
          : []
      )
      .filter(Boolean);
    expect(titles).toEqual(["Ginger stew", "Lemon soup"]);
  });

  it("is null for another household's cookbook", async () => {
    const deps = setup({ book: cookbook({ householdId: OTHER_HOUSEHOLD }) });
    expect(
      await loadReaderBook("00000000-0000-4000-8000-000000000020", HOUSEHOLD, deps)
    ).toBeNull();
  });

  it("is null when the cookbook does not exist", async () => {
    const deps = setup({ book: null });
    expect(
      await loadReaderBook("00000000-0000-4000-8000-000000000020", HOUSEHOLD, deps)
    ).toBeNull();
  });

  it("keeps the settings title and subtitle over the cookbook name", async () => {
    const deps = setup({
      book: cookbook({ bookSettings: { title: "House book", subtitle: "By Nan" } }),
    });
    const book = await loadReaderBook("00000000-0000-4000-8000-000000000020", HOUSEHOLD, deps);
    expect(book!.title).toBe("House book");
    expect(book!.subtitle).toBe("By Nan");
    expect(book!.pages[0]).toMatchObject({ kind: "cover", title: "House book" });
  });

  it("skips recipes that vanished and numbers pages from 1", async () => {
    const deps = setup({ ids: ["r1", "gone", "r2"], byId: { r1: details("r1", "Lemon soup") } });
    const book = await loadReaderBook("00000000-0000-4000-8000-000000000020", HOUSEHOLD, deps);
    const numbers = book!.pages.map((page: any) => page.number);
    expect(numbers).toEqual(numbers.map((_, i) => i + 1));
    expect(book!.pages[book!.pages.length - 1]!.kind).toBe("colophon");
  });

  it("lays out an empty book as zero pages instead of throwing", async () => {
    const deps = setup({ ids: [] });
    const book = await loadReaderBook("00000000-0000-4000-8000-000000000020", HOUSEHOLD, deps);
    expect(book!.pages).toEqual([]);
  });
});
