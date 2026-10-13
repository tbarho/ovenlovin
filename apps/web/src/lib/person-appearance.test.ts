import { describe, expect, it } from "vitest";
import {
  appearanceForPerson,
  fallbackAppearance,
  parsePersonNotes,
  writePersonNotes,
} from "./person-appearance";

describe("person appearance notes", () => {
  it("round-trips emoji and color without dropping leftover notes", () => {
    const notes = writePersonNotes({ emoji: "⚽️", color: "#2f9e62" }, "Child B, soccer");
    expect(JSON.parse(notes)).toMatchObject({
      ol: 1,
      emoji: "⚽️",
      color: "#2f9e62",
      text: "Child B, soccer",
    });
    expect(parsePersonNotes(notes)).toEqual({
      appearance: { emoji: "⚽️", color: "#2f9e62" },
      text: "Child B, soccer",
    });
  });

  it("keeps existing plain-text notes readable", () => {
    expect(parsePersonNotes("likes soccer")).toEqual({
      appearance: {},
      text: "likes soccer",
    });
  });

  it("falls back to a stable emoji when notes have no avatar", () => {
    const first = fallbackAppearance("child-b");
    const second = fallbackAppearance("child-b");
    expect(first).toEqual(second);
    expect(appearanceForPerson({ id: "child-b", notes: "plain" }).emoji).toBe(first.emoji);
  });
});
