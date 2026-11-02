import { describe, expect, it } from "vitest";
import { paginate } from "./paginate";
import {
  BookSettingsError,
  bookSettingsInputSchema,
  normalizeBookSettings,
  orderedRecipeIds,
} from "./settings";

const A = "550e8400-e29b-41d4-a716-446655440001";
const B = "550e8400-e29b-41d4-a716-446655440002";
const C = "550e8400-e29b-41d4-a716-446655440003";

const recipe = (id: string, overrides: any = {}) => ({
  id,
  title: `Recipe ${id.slice(-1)}`,
  course: "Mains",
  images: [`https://img/${id}.jpg`],
  ingredients: [{ name: "butter", rawText: "1 cup butter" }],
  steps: [{ text: "Mix." }],
  ...overrides,
});

const book = {
  name: "Household 1 kitchen",
  recipes: [
    recipe(A),
    recipe(B, { isFamilyRecipe: true, sourcePhotos: ["https://img/card-b.jpg"] }),
    recipe(C),
  ],
};

describe("make it yours: settings in, pages out", () => {
  it("drops blank text so blank means the house default", () => {
    expect(
      normalizeBookSettings({ title: "  ", subtitle: " Est. 1970 ", dedication: "" }, [A])
    ).toEqual({ subtitle: "Est. 1970" });
  });

  it("refuses a cover recipe that is not in the book, with a next step", () => {
    expect(() => normalizeBookSettings({ cover: { kind: "recipe", recipeId: C } }, [A, B])).toThrow(
      BookSettingsError
    );
  });

  it("refuses arbitrary cover photo URLs", () => {
    expect(
      bookSettingsInputSchema.safeParse({ cover: { kind: "photo", image: "https://x/y.jpg" } })
        .success
    ).toBe(false);
  });

  it("sets the cover, title, subtitle, and dedication", () => {
    const settings = normalizeBookSettings(
      {
        cover: { kind: "recipe", recipeId: C },
        title: "Recipes from Parent A",
        subtitle: "Holidays 2026",
        dedication: "For Parent A, holidays 2026",
      },
      [A, B, C]
    );
    const pages = paginate(book, settings);
    expect(pages[0]).toMatchObject({
      kind: "cover",
      title: "Recipes from Parent A",
      subtitle: "Holidays 2026",
      image: `https://img/${C}.jpg`,
    });
    expect(pages[1]).toMatchObject({ kind: "dedication", text: "For Parent A, holidays 2026" });
    expect(pages.at(-1)).toMatchObject({ kind: "colophon", title: "Recipes from Parent A" });
  });

  it("type-only cover has no photo", () => {
    expect(paginate(book, { cover: { kind: "type" } })[0].image).toBeNull();
  });

  it("original cards come and go with includeCards, and page numbers follow", () => {
    const withCards = paginate(book, {});
    const without = paginate(book, normalizeBookSettings({ includeCards: false }, [A, B, C]));
    expect(withCards.filter((p: any) => p.kind === "original-card")).toHaveLength(1);
    expect(without.filter((p: any) => p.kind === "original-card")).toHaveLength(0);
    expect(without.length).toBe(withCards.length - 1);
    without.forEach((page: any, i: number) => expect(page.number).toBe(i + 1));
  });
});

describe("orderedRecipeIds", () => {
  it("accepts every recipe once in a new order", () => {
    expect(orderedRecipeIds([A, B, C], [C, A, B])).toEqual([C, A, B]);
  });

  it("refuses duplicates, strangers, and missing recipes", () => {
    expect(() => orderedRecipeIds([A, B], [A, A])).toThrow(/duplicates/);
    expect(() => orderedRecipeIds([A, B], [A, C])).toThrow(/not in this cookbook/);
    expect(() => orderedRecipeIds([A, B, C], [A, B])).toThrow(/every recipe/);
  });

  it("the book follows the order", () => {
    const order = orderedRecipeIds([A, B, C], [C, B, A]);
    const reordered = {
      ...book,
      recipes: order.map((id) => book.recipes.find((r) => r.id === id)),
    };
    const contents = paginate(reordered, {}).find((p: any) => p.kind === "contents");
    expect(contents.entries.map((e: any) => e.recipeId)).toEqual([C, B, A]);
  });
});
