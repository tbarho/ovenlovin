import { describe, expect, it } from "vitest";
import { buildContentsMap, type ContentsMap, type PdfPageText } from "./contents-map";
import {
  MAX_RECIPE_SPAN,
  mergeSpanLines,
  planRecipeItems,
  recipeProgress,
  trimSpan,
} from "./recipe-spans";

const book = (pages: string[][]): PdfPageText[] =>
  pages.map((lines, index) => ({ page: index + 1, lines }));

const recipe = (title: string, printed: number) => [
  title,
  "Serves 4",
  "2 cups flour",
  "1 tsp salt",
  "Mix everything and bake.",
  String(printed),
];

/** Contents, two breakfast recipes (pancakes run two pages), a divider, a supper, an index. */
const pages = book([
  [
    "Contents",
    "Breakfast",
    "Buttermilk Pancakes ........ 2",
    "Oat Porridge ........ 4",
    "Suppers",
    "Tomato Soup ........ 6",
  ],
  recipe("Buttermilk Pancakes", 2),
  ["Flip when bubbles form.", "3"],
  recipe("Oat Porridge", 4),
  ["Suppers", "5"],
  recipe("Tomato Soup", 6),
  ["Index", "Oat Porridge, 4", "Tomato Soup, 6"],
]);
const map = buildContentsMap(pages);
const ids = map.candidates.map((candidate) => candidate.id);

describe("planRecipeItems", () => {
  it("spans each pick to the page before the next recipe, in book order", () => {
    const items = planRecipeItems(map, ids, pages.length);
    expect(
      items.map(({ title, pageStart, pageEnd, nextGroup }) => ({
        title,
        pageStart,
        pageEnd,
        nextGroup,
      }))
    ).toEqual([
      { title: "Buttermilk Pancakes", pageStart: 2, pageEnd: 3, nextGroup: null },
      { title: "Oat Porridge", pageStart: 4, pageEnd: 5, nextGroup: "Suppers" },
      { title: "Tomato Soup", pageStart: 6, pageEnd: 7, nextGroup: null },
    ]);
  });

  it("bounds a span by unpicked recipes too", () => {
    const items = planRecipeItems(map, [ids[0]!, ids[2]!], pages.length);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ pageStart: 2, pageEnd: 3, nextTitle: "Oat Porridge" });
  });

  it("stops before the contents or index pages and caps long spans", () => {
    const long: ContentsMap = {
      ...map,
      mapPages: [30],
      candidates: [{ id: "a", title: "A", group: null, printedPage: 1, pdfPage: 2 }],
    };
    expect(planRecipeItems(long, ["a"], 40)[0]).toMatchObject({
      pageStart: 2,
      pageEnd: 2 + MAX_RECIPE_SPAN - 1,
    });
    expect(planRecipeItems({ ...long, mapPages: [3] }, ["a"], 40)[0]).toMatchObject({
      pageEnd: 2,
    });
  });

  it("gives two recipes on one page the same single page", () => {
    const shared: ContentsMap = {
      ...map,
      mapPages: [],
      candidates: [
        { id: "a", title: "Lemonade", group: null, printedPage: 1, pdfPage: 2 },
        { id: "b", title: "Iced Tea", group: null, printedPage: 1, pdfPage: 2 },
      ],
    };
    expect(
      planRecipeItems(shared, ["a", "b"], 5).map((item) => [item.pageStart, item.pageEnd])
    ).toEqual([
      [2, 2],
      [2, 5],
    ]);
  });
});

describe("trimSpan", () => {
  it("drops a trailing section divider but keeps the recipe's own continuation", () => {
    expect(trimSpan(pages.slice(3, 5), "Suppers").map((page) => page.page)).toEqual([4]);
    expect(trimSpan(pages.slice(1, 3)).map((page) => page.page)).toEqual([2, 3]);
  });
});

describe("mergeSpanLines", () => {
  it("merges a recipe that crosses pages into one clean text", () => {
    const span = book([
      [
        "Breakfast 12",
        "The last of the granola.",
        "Buttermilk Pancakes",
        "Our Sunday stack.",
        "2 cups flour",
        "1 cup butter-",
        "12",
      ],
      [
        "Breakfast 13",
        "milk",
        "2 eggs",
        "Whisk and cook on a hot griddle.",
        "Oat Porridge",
        "1 cup oats",
        "13",
      ],
    ]);
    expect(mergeSpanLines(span, "Buttermilk Pancakes", "Oat Porridge")).toEqual([
      "Buttermilk Pancakes",
      "Our Sunday stack.",
      "2 cups flour",
      "1 cup buttermilk",
      "2 eggs",
      "Whisk and cook on a hot griddle.",
    ]);
  });

  it("keeps a one-page recipe intact", () => {
    expect(mergeSpanLines(book([recipe("Tomato Soup", 6)]), "Tomato Soup")).toEqual(
      recipe("Tomato Soup", 6).slice(0, -1)
    );
  });
});

describe("recipeProgress", () => {
  it("counts recipe items only", () => {
    expect(
      recipeProgress([
        { status: "done", payload: { step: "verify" } },
        { status: "done", payload: { step: "recipe" } },
        { status: "failed", payload: { step: "recipe" } },
        { status: "pending", payload: { step: "recipe" } },
      ])
    ).toEqual({ total: 3, done: 1, failed: 1 });
  });
});
