import { describe, expect, it } from "vitest";
import { paginate } from "./paginate";
import { PRINT_SPEC, printChunks, printSheet } from "./print";

const kinds = (list: string[]) => list.map((kind) => ({ kind }));

describe("printChunks", () => {
  it("breaks where a chapter starts", () => {
    const pages = kinds(["cover", "contents", "section", "photo", "recipe", "section", "photo"]);
    expect(printChunks(pages)).toEqual([
      { from: 1, to: 2 },
      { from: 3, to: 5 },
      { from: 6, to: 7 },
    ]);
  });

  it("never runs past the page cap", () => {
    const pages = kinds(Array.from({ length: 10 }, () => "recipe"));
    expect(printChunks(pages, 4)).toEqual([
      { from: 1, to: 4 },
      { from: 5, to: 8 },
      { from: 9, to: 10 },
    ]);
  });

  it("covers every page exactly once for a real book", () => {
    const recipes = Array.from({ length: 300 }, (_, i) => ({
      id: `r${i}`,
      title: `Recipe ${i}`,
      course: ["Breakfast", "Mains", "Desserts"][i % 3],
      ingredients: [{ name: "flour", rawText: "1 cup flour" }],
      steps: [{ text: "Mix." }],
    }));
    const pages = paginate({ name: "Big", recipes });
    const chunks = printChunks(pages);
    const covered = chunks.flatMap((c) =>
      Array.from({ length: c.to - c.from + 1 }, (_, i) => c.from + i)
    );
    expect(covered).toEqual(pages.map((page: any) => page.number));
    expect(chunks.every((c) => c.to - c.from + 1 <= PRINT_SPEC.chunkPages)).toBe(true);
  });

  it("is empty for an empty book", () => {
    expect(printChunks([])).toEqual([]);
  });
});

describe("printSheet", () => {
  it("is the trim at home", () => {
    expect(printSheet("home")).toEqual({ w: 8.5, h: 11, pad: 0 });
  });

  it("adds bleed and a crop-mark slug for a print shop", () => {
    expect(printSheet("shop")).toEqual({ w: 9.25, h: 11.75, pad: 0.375 });
  });
});
