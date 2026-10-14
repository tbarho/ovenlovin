import type { Active, Over } from "@dnd-kit/core";
import { describe, expect, it } from "vitest";
import {
  movedLiveMessage,
  peopleReorderAnnouncements,
  peopleReorderInstructions,
} from "./people-reorder-a11y";

const ty = { id: "a" } as Active;
const jake = { id: "b" } as Over;

describe("people reorder announcements", () => {
  const announcements = peopleReorderAnnouncements((id) => (id === "a" ? "Ty" : "Jake"));

  it("names the person on lift, move, drop, and cancel", () => {
    expect(announcements.onDragStart({ active: ty })).toBe("Picked up Ty.");
    expect(announcements.onDragOver({ active: ty, over: jake })).toBe("Ty is over Jake.");
    expect(announcements.onDragEnd({ active: ty, over: jake })).toBe("Moved Ty.");
    expect(announcements.onDragCancel({ active: ty, over: null })).toBe("Cancelled reordering Ty.");
  });

  it("announces the new index after a move", () => {
    expect(movedLiveMessage("Ty", 1, 5)).toBe("Moved Ty. Now 2 of 5.");
  });

  it("teaches space-to-lift keyboard reorder", () => {
    expect(peopleReorderInstructions.draggable).toMatch(/space/i);
    expect(peopleReorderInstructions.draggable).toMatch(/arrow/i);
  });
});
