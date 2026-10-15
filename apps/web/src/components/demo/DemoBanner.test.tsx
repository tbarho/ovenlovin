import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { DemoBanner } from "./DemoBanner";

describe("DemoBanner", () => {
  it("keeps Reset kitchen quiet until confirmed", async () => {
    const user = userEvent.setup();
    render(<DemoBanner />);

    const reset = screen.getByRole("button", { name: "Reset kitchen" });
    expect(reset).toHaveClass("demo-banner-reset");
    expect(reset).not.toHaveClass("btn");

    await user.click(reset);
    expect(apiFormHidden()).toBeTruthy();
    const dialog = screen.getByRole("dialog", { name: /reset this kitchen/i });
    expect(dialog).toHaveTextContent(/fresh sample kitchen/i);
    expect(dialog).toHaveTextContent(/edits in this demo will be gone/i);
  });
});

function apiFormHidden() {
  return document.getElementById("demo-reset-form");
}
