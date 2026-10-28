import { describe, expect, it } from "vitest";
import { triageSummary } from "./book-triage";
import { buildPhotoContentsMap, type PdfPageText } from "./contents-map";
import { shotLabel, shotLine, shotOrder, shotRows } from "./shot-list";

const photos = (pages: string[][]): PdfPageText[] =>
  pages.map((lines, index) => ({ page: index + 1, lines }));

const contents = photos([
  ["Contents", "Suppers", "Short ribs ........ 112", "Corn bread 140"],
  ["Baking", "Lemon bars .... 38", "Toast"],
]);

describe("buildPhotoContentsMap", () => {
  it("reads contents photos with no offset and keeps sections", () => {
    const map = buildPhotoContentsMap(contents);
    expect(map).toMatchObject({ source: "contents", offset: 0, calibrated: true, mapPages: [] });
    expect(map.candidates.map((candidate) => [candidate.title, candidate.group])).toEqual([
      ["Short ribs", "Suppers"],
      ["Corn bread", "Suppers"],
      ["Lemon bars", "Baking"],
    ]);
    expect(map.candidates.every((candidate) => candidate.pdfPage === null)).toBe(true);
  });

  it("needs no heading: the person said these are contents pages", () => {
    const map = buildPhotoContentsMap(photos([["Short ribs 112", "Corn bread 140"]]));
    expect(map.candidates.map((candidate) => candidate.printedPage)).toEqual([112, 140]);
  });

  it("reads index photos by page and drops ingredients cited on several pages", () => {
    const map = buildPhotoContentsMap(
      photos([["Index", "Butter, 12, 40, 88", "Short ribs, 112", "Apple cake, 20"]])
    );
    expect(map.source).toBe("index");
    expect(map.candidates.map((candidate) => candidate.title)).toEqual([
      "Apple cake",
      "Short ribs",
    ]);
  });

  it("spots an index photo with no heading by its comma lines", () => {
    const map = buildPhotoContentsMap(photos([["Plum jam, 210", "Pork chops, 98", "Rice, 4, 9"]]));
    expect(map.candidates.map((candidate) => candidate.title)).toEqual(["Pork chops", "Plum jam"]);
  });

  it("adds index-only recipes after the contents, without repeating titles", () => {
    const map = buildPhotoContentsMap([
      ...contents,
      { page: 3, lines: ["Index", "Short ribs, 112", "Fig tart, 150"] },
    ]);
    expect(map.candidates.map((candidate) => candidate.title)).toEqual([
      "Short ribs",
      "Corn bread",
      "Lemon bars",
      "Fig tart",
    ]);
  });

  it("finds nothing on a blurry read", () => {
    const map = buildPhotoContentsMap(photos([["blurry"], []]));
    expect(map).toMatchObject({ source: "none", calibrated: false, candidates: [] });
  });
});

describe("shot list", () => {
  const map = buildPhotoContentsMap(contents);
  const ids = map.candidates.map((candidate) => candidate.id);

  it("labels with the printed page first", () => {
    expect(shotLabel({ title: "Short ribs", printedPage: 112 })).toBe("p. 112 Short ribs");
    expect(shotLabel({ title: "Toast", printedPage: null })).toBe("Toast");
  });

  it("orders picks by page so the book is flipped once", () => {
    const pageless = { id: "x", title: "Toast", group: null, printedPage: null, pdfPage: null };
    expect(
      shotOrder([...map.candidates, pageless], [...ids, "x"]).map((candidate) => candidate.title)
    ).toEqual(["Lemon bars", "Short ribs", "Corn bread", "Toast"]);
    expect(shotOrder(map.candidates, [ids[1]!]).map((candidate) => candidate.title)).toEqual([
      "Corn bread",
    ]);
  });

  it("rows are shoot until saved, in shot order", () => {
    const rows = shotRows(map, ids, { [ids[0]!]: "recipe-1" });
    expect(rows.map((row) => [row.title, row.page, row.order, row.state])).toEqual([
      ["Lemon bars", 38, 0, "shoot"],
      ["Short ribs", 112, 1, "saved"],
      ["Corn bread", 140, 2, "shoot"],
    ]);
    expect(rows[1]!.recipeId).toBe("recipe-1");
  });

  it("counts photographed recipes for the shelf", () => {
    expect(shotLine(triageSummary([]))).toBe("Pick your recipes");
    expect(shotLine(triageSummary(shotRows(map, ids, { [ids[0]!]: "r" })))).toBe(
      "1 of 3 photographed"
    );
    const all = Object.fromEntries(ids.map((id) => [id, id]));
    expect(shotLine(triageSummary(shotRows(map, ids, all)))).toBe("3 of 3 saved");
  });
});
