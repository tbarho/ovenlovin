import { describe, expect, it } from "vitest";
import {
  movedLiveMessage,
  peopleReorderAnnouncements,
  peopleReorderInstructions,
} from "./people-reorder-a11y";

describe("people reorder announcements", () => {
  const announcements = peopleReorderAnnouncements((id) => (id === "a" ? "Ty" : "Jake"));

  it("names the person on lift, move, drop, and cancel", () => {
    expect(announcements.onDragStart({ active: { id: "a" } as never })).toBe("Picked up Ty.");
    expect(
      announcements.onDragOver({ active: { id: "a" } as never, over: { id: "b" } as never })
    ).toBe("Ty is over Jake.");
    expect(
      announcements.onDragEnd({ active: { id: "a" } as never, over: { id: "b" } as never })
    ).toBe("Moved Ty.");
    expect(announcements.onDragCancel({ active: { id: "a" } as never })).toBe(
      "Cancelled reordering Ty."
    );
  });

  it("announces the new index after a move", () => {
    expect(movedLiveMessage("Ty", 1, 5)).toBe("Moved Ty. Now 2 of 5.");
  });

  it("teaches space-to-lift keyboard reorder", () => {
    expect(peopleReorderInstructions.draggable).toMatch(/space/i);
    expect(peopleReorderInstructions.draggable).toMatch(/arrow/i);
  });
});
