import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { testPerson } from "@/test/fixtures";
import { PeopleReorder } from "./PeopleReorder";

function mockSlotRects() {
  const slots = document.querySelectorAll<HTMLElement>(".olp-person-slot");
  slots.forEach((el, index) => {
    const top = index * 140;
    el.getBoundingClientRect = () =>
      ({
        x: 0,
        y: top,
        top,
        bottom: top + 132,
        left: 0,
        right: 320,
        width: 320,
        height: 132,
        toJSON: () => ({}),
      }) as DOMRect;
  });
}

describe("PeopleReorder", () => {
  it("keeps the handle inside the card and drops up/down controls", () => {
    const ty = testPerson({ displayName: "Ty" });
    render(
      <PeopleReorder
        people={[ty]}
        renderPerson={(person) => <span>{person.displayName}</span>}
        onReorder={vi.fn()}
      />
    );

    expect(screen.queryByRole("button", { name: /move .+ up/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /move .+ down/i })).not.toBeInTheDocument();
    const handle = screen.getByRole("button", { name: "Reorder Ty" });
    expect(handle).toHaveStyle({ minWidth: "44px", minHeight: "44px", cursor: "grab" });
    expect(handle.closest(`[data-testid="person-card-shell-${ty.id}"]`)).toBeTruthy();
  });

  it("persists a keyboard reorder and announces the new position", async () => {
    const ty = testPerson({
      id: "00000000-0000-4000-8000-000000000010",
      displayName: "Ty",
      sortOrder: 0,
    });
    const jake = testPerson({
      id: "00000000-0000-4000-8000-000000000011",
      displayName: "Jake",
      sortOrder: 1,
    });
    const onReorder = vi.fn().mockResolvedValue(undefined);
    render(
      <PeopleReorder
        people={[ty, jake]}
        renderPerson={(person) => <span>{person.displayName}</span>}
        onReorder={onReorder}
      />
    );

    mockSlotRects();
    const handle = screen.getByRole("button", { name: "Reorder Ty" });
    handle.focus();
    fireEvent.keyDown(handle, { key: " ", code: "Space" });
    await waitFor(() => {
      expect(screen.getByTestId("people-drag-overlay")).toBeInTheDocument();
    });
    mockSlotRects();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fireEvent.keyDown(document, { key: "ArrowDown", code: "ArrowDown" });
    fireEvent.keyDown(document, { key: " ", code: "Space" });

    await waitFor(() => {
      expect(onReorder).toHaveBeenCalledWith([jake.id, ty.id]);
    });
    expect(screen.getByTestId("people-reorder-live")).toHaveTextContent("Moved Ty. Now 2 of 2.");
  });
});
