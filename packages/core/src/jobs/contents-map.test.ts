import { describe, expect, it } from "vitest";
import {
  buildContentsMap,
  calibrateOffset,
  groupCandidates,
  resolvePicks,
  searchCandidates,
  type PdfPageText,
} from "./contents-map";

const book = (pages: string[][]): PdfPageText[] =>
  pages.map((lines, index) => ({ page: index + 1, lines }));

const recipe = (title: string, printed?: number) => [
  title,
  "Serves 4",
  "2 cups flour",
  "1 tsp salt",
  "3 eggs",
  "Mix everything and bake.",
  ...(printed ? [String(printed)] : []),
];

/** 2 pages of front matter, contents, then recipes printed from page 1. */
const offsetBook = book([
  ["A Synthetic Kitchen", "Author A"],
  [
    "Contents",
    "Breakfast",
    "Buttermilk Pancakes ........ 1",
    "Oat Porridge ........ 2",
    "Suppers",
    "Tomato Soup ........ 3",
    "Roast Chicken ........ 4",
  ],
  recipe("Buttermilk Pancakes", 1),
  recipe("Oat Porridge", 2),
  recipe("Tomato Soup", 3),
  recipe("Roast Chicken", 4),
]);

describe("buildContentsMap", () => {
  it("maps a contents page and calibrates the front matter offset", () => {
    expect(buildContentsMap(offsetBook)).toEqual({
      source: "contents",
      offset: 2,
      calibrated: true,
      mapPages: [2],
      scannedPages: [],
      candidates: [
        {
          id: "1-buttermilk-pancakes",
          title: "Buttermilk Pancakes",
          group: "Breakfast",
          printedPage: 1,
          pdfPage: 3,
        },
        {
          id: "2-oat-porridge",
          title: "Oat Porridge",
          group: "Breakfast",
          printedPage: 2,
          pdfPage: 4,
        },
        { id: "3-tomato-soup", title: "Tomato Soup", group: "Suppers", printedPage: 3, pdfPage: 5 },
        {
          id: "4-roast-chicken",
          title: "Roast Chicken",
          group: "Suppers",
          printedPage: 4,
          pdfPage: 6,
        },
      ],
    });
  });

  it("reads a contents page with no front matter shift and no heading", () => {
    const map = buildContentsMap(
      book([
        ["Lemon Bars 3", "Shortbread 4", "Ginger Snaps 5", "Brownies 6", "Fudge 7"],
        ["Notes"],
        recipe("Lemon Bars"),
        recipe("Shortbread"),
        recipe("Ginger Snaps"),
        recipe("Brownies"),
        recipe("Fudge"),
      ])
    );
    expect(map.source).toBe("contents");
    expect(map.offset).toBe(0);
    expect(map.calibrated).toBe(true);
    expect(map.candidates.map((candidate) => [candidate.title, candidate.pdfPage])).toEqual([
      ["Lemon Bars", 3],
      ["Shortbread", 4],
      ["Ginger Snaps", 5],
      ["Brownies", 6],
      ["Fudge", 7],
    ]);
  });

  it("falls back to the index and keeps only single-page entries", () => {
    const map = buildContentsMap(
      book([
        ["Front"],
        recipe("Apple Crumble"),
        recipe("Pear Tart"),
        ["Index", "Apple Crumble, 1", "Apples, 1, 2", "Pear Tart, 2"],
      ])
    );
    expect(map.source).toBe("index");
    expect(map.offset).toBe(1);
    expect(map.candidates.map((candidate) => candidate.title)).toEqual([
      "Apple Crumble",
      "Pear Tart",
    ]);
  });

  it("detects title plus ingredients per page when there is no contents", () => {
    const map = buildContentsMap(
      book([
        ["A Synthetic Kitchen"],
        recipe("Fish Stew"),
        ["Just a photo caption."],
        recipe("Rice Pudding"),
      ])
    );
    expect(map).toEqual({
      source: "pages",
      offset: 0,
      calibrated: false,
      mapPages: [],
      scannedPages: [],
      candidates: [
        { id: "p2-fish-stew", title: "Fish Stew", group: null, printedPage: null, pdfPage: 2 },
        {
          id: "p4-rice-pudding",
          title: "Rice Pudding",
          group: null,
          printedPage: null,
          pdfPage: 4,
        },
      ],
    });
  });

  it("lists scanned pages and reports none when nothing reads", () => {
    expect(buildContentsMap(book([[], [], []]))).toEqual({
      source: "none",
      offset: 0,
      calibrated: false,
      mapPages: [],
      scannedPages: [1, 2, 3],
      candidates: [],
    });
  });

  it("gives repeated titles distinct ids", () => {
    const map = buildContentsMap(
      book([["Contents", "Pancakes 2", "Pancakes 2"], recipe("Pancakes")])
    );
    expect(map.candidates.map((candidate) => candidate.id)).toEqual(["2-pancakes", "2-pancakes~2"]);
  });
});

describe("calibrateOffset", () => {
  it("lets the most agreeing finds win over a stray match", () => {
    const pages = book([
      recipe("Soup"),
      ["x"],
      ["x"],
      recipe("Soup"),
      recipe("Bread"),
      recipe("Cake"),
    ]);
    const entries = [
      { title: "Soup", printedPage: 1, group: null },
      { title: "Bread", printedPage: 2, group: null },
      { title: "Cake", printedPage: 3, group: null },
    ];
    expect(calibrateOffset(entries, pages)).toEqual({ offset: 3, calibrated: true });
  });

  it("is uncalibrated when no title is found", () => {
    expect(
      calibrateOffset([{ title: "Soup", printedPage: 1, group: null }], book([["x"]]))
    ).toEqual({
      offset: 0,
      calibrated: false,
    });
  });
});

describe("contents screen helpers", () => {
  const { candidates } = buildContentsMap(offsetBook);

  it("searches titles and groups", () => {
    expect(searchCandidates(candidates, "soup").map((candidate) => candidate.title)).toEqual([
      "Tomato Soup",
    ]);
    expect(searchCandidates(candidates, "breakfast")).toHaveLength(2);
    expect(searchCandidates(candidates, "  ")).toHaveLength(4);
  });

  it("groups in book order", () => {
    expect(groupCandidates(candidates).map((group) => [group.name, group.items.length])).toEqual([
      ["Breakfast", 2],
      ["Suppers", 2],
    ]);
  });

  it("defaults picks to all and drops unknown ids", () => {
    expect(resolvePicks(candidates, undefined)).toHaveLength(4);
    expect(resolvePicks(candidates, ["3-tomato-soup", "gone"])).toEqual(["3-tomato-soup"]);
    expect(resolvePicks(candidates, [])).toEqual([]);
  });
});
