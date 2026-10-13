import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
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
