import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { typeFullWordAndKeepFocus } from "@/test/sheet-focus";
import { BottomSheet } from "./BottomSheet";

function SheetHarness() {
  const [title, setTitle] = useState("Pasta");
  const [servings, setServings] = useState("4");
  return (
    <BottomSheet open title="Edit details" onClose={() => undefined}>
      <label>
        Title
        <input value={title} onChange={(event) => setTitle(event.target.value)} />
      </label>
      <label>
        Servings
        <input value={servings} onChange={(event) => setServings(event.target.value)} />
      </label>
    </BottomSheet>
  );
}

describe("BottomSheet", () => {
  afterEach(() => {
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: undefined,
    });
  });

  it("keeps focus in the first field after every keystroke", async () => {
    const user = userEvent.setup();
    render(<SheetHarness />);
    await typeFullWordAndKeepFocus(user, screen.getByLabelText("Title"), "Garlic");
  });

  it("keeps focus in a later field after every keystroke", async () => {
    const user = userEvent.setup();
    render(<SheetHarness />);
    await typeFullWordAndKeepFocus(user, screen.getByLabelText("Servings"), "12");
  });

  it("sizes the sheet to the visual viewport without moving focus", async () => {
    const user = userEvent.setup();
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: { height: 520, offsetTop: 12, addEventListener() {}, removeEventListener() {} },
    });
    render(<SheetHarness />);
    const root = document.querySelector(".sheet-root");
    expect(root).toBeTruthy();
    expect((root as HTMLElement).style.getPropertyValue("--sheet-vv-height")).toBe("520px");
    expect((root as HTMLElement).style.getPropertyValue("--sheet-vv-top")).toBe("12px");
    const input = screen.getByLabelText("Title");
    await user.click(input);
    await user.keyboard("ok");
    expect(document.activeElement).toBe(input);
  });

  it("portals the overlay onto document.body so it covers the app header", () => {
    const { container } = render(<SheetHarness />);
    const root = document.querySelector(".sheet-root");
    expect(root).toBeTruthy();
    expect(root?.parentElement).toBe(document.body);
    expect(container.querySelector(".sheet-root")).toBeNull();
  });

  it("does not move focus to Close while typing", async () => {
    const user = userEvent.setup();
    render(<SheetHarness />);
    const input = screen.getByLabelText("Title");
    await user.click(input);
    await user.keyboard("ok");
    expect(document.activeElement).toBe(input);
    expect(document.activeElement).not.toBe(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Close" })
    );
  });
});
