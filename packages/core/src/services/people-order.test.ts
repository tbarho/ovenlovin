import { describe, expect, it } from "vitest";
import {
  PeopleOrderError,
  comparePeopleOrder,
  movePersonId,
  orderedPersonIds,
} from "./people-order";

describe("people order", () => {
  it("accepts a complete permutation", () => {
    expect(orderedPersonIds(["a", "b", "c"], ["c", "a", "b"])).toEqual(["c", "a", "b"]);
  });

  it("rejects a partial list", () => {
    expect(() => orderedPersonIds(["a", "b"], ["a"])).toThrow(PeopleOrderError);
  });

  it("rejects unknown ids", () => {
    expect(() => orderedPersonIds(["a"], ["b"])).toThrow(/Unknown person id/);
  });

  it("moves a person up and down", () => {
    expect(movePersonId(["a", "b", "c"], "c", -1)).toEqual(["a", "c", "b"]);
    expect(movePersonId(["a", "b", "c"], "a", -1)).toEqual(["a", "b", "c"]);
    expect(movePersonId(["a", "b", "c"], "c", 1)).toEqual(["a", "b", "c"]);
  });

  it("sorts by sortOrder then createdAt", () => {
    const people = [
      { id: "b", sortOrder: 1, createdAt: "2026-01-02T00:00:00.000Z" },
      { id: "a", sortOrder: 0, createdAt: "2026-01-03T00:00:00.000Z" },
      { id: "c", sortOrder: 1, createdAt: "2026-01-01T00:00:00.000Z" },
    ];
    expect([...people].sort(comparePeopleOrder).map((item) => item.id)).toEqual(["a", "c", "b"]);
  });
});
