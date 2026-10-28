import { describe, expect, it, vi } from "vitest";

vi.mock("@ovenlovin/db", () => ({ getDatabase: () => ({}) }));

import { buildPhotoContentsMap } from "@ovenlovin/core/jobs";
import { createShotBook, listShotBookTiles, loadBookShotList } from "./book-shot-view";

const HOUSEHOLD = "22222222-2222-4222-8222-222222222222";
const JOB = "44444444-4444-4444-8444-444444444444";

const MAP = buildPhotoContentsMap([
  { page: 1, lines: ["Contents", "Suppers", "Short ribs ........ 112", "Corn bread 140"] },
]);

const input = (overrides: Record<string, unknown> = {}) => ({
  name: "A Paper Pantry",
  sha256: "papersha",
  blobUrl: "",
  pages: 0,
  verified: true,
  source: "photos",
  photoMap: MAP,
  picks: MAP.candidates.map((candidate) => candidate.id),
  shooting: true,
  ...overrides,
});

const queue = (overrides: Record<string, unknown> = {}) =>
  ({
    get: vi.fn(async () => ({
      id: JOB,
      householdId: HOUSEHOLD,
      kind: "book_import",
      input: input(overrides),
    })),
    items: vi.fn(async () => []),
    patchInput: vi.fn(async () => undefined),
    enqueue: vi.fn(async () => "new-job"),
    recent: vi.fn(async () => [JOB]),
  }) as any;

const recipes = () =>
  ({
    listBookImportRecipeIds: vi.fn(async () => ({ [MAP.candidates[0]!.id]: "recipe-1" })),
  }) as any;

describe("loadBookShotList", () => {
  it("serves the shot list in page order, marking saved shots", async () => {
    const saved = recipes();
    const view = await loadBookShotList(queue(), JOB, HOUSEHOLD, saved);
    expect(saved.listBookImportRecipeIds).toHaveBeenCalledTimes(1);
    expect(view?.shooting).toBe(true);
    expect(view?.triage.rows.map((row) => [row.title, row.page, row.state])).toEqual([
      ["Short ribs", 112, "saved"],
      ["Corn bread", 140, "shoot"],
    ]);
    expect(view?.triage.line).toBe("1 of 2 photographed");
  });

  it("leaves saved lookups alone until the picks are confirmed", async () => {
    const quiet = recipes();
    await loadBookShotList(queue({ shooting: false }), JOB, HOUSEHOLD, quiet);
    expect(quiet.listBookImportRecipeIds).not.toHaveBeenCalled();
  });

  it("ignores PDF books", async () => {
    const pdf = queue({ source: undefined, photoMap: undefined });
    expect(await loadBookShotList(pdf, JOB, HOUSEHOLD, recipes())).toBeNull();
  });
});

describe("listShotBookTiles", () => {
  it("keeps books with something still to photograph", async () => {
    const tiles = await listShotBookTiles(queue(), HOUSEHOLD, recipes());
    expect(tiles).toEqual([{ jobId: JOB, name: "A Paper Pantry", line: "1 of 2 photographed" }]);
  });

  it("drops finished books", async () => {
    const done = recipesDone();
    const tiles = await listShotBookTiles(queue(), HOUSEHOLD, done);
    expect(tiles).toEqual([]);
  });
});

function recipesDone() {
  const all: Record<string, string> = {};
  for (const candidate of MAP.candidates) all[candidate.id] = "r";
  return { listBookImportRecipeIds: vi.fn(async () => all) } as any;
}

describe("createShotBook", () => {
  it("enqueues the book around the read map, with no items", async () => {
    const q = queue();
    const jobId = await createShotBook(q, HOUSEHOLD, {
      name: "A Paper Pantry",
      sha256: "s",
      map: MAP,
    });
    expect(jobId).toBe("new-job");
    expect(q.enqueue).toHaveBeenCalledTimes(1);
    const [household, kind, jobInput] = q.enqueue.mock.calls[0];
    expect([household, kind]).toEqual([HOUSEHOLD, "book_import"]);
    expect(jobInput).toMatchObject({ source: "photos", photoMap: MAP, verified: true });
  });
});
