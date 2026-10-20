import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DemoBanner } from "./DemoBanner";

describe("DemoBanner", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps Reset kitchen quiet until confirmed", async () => {
    const user = userEvent.setup();
    render(<DemoBanner />);

    const reset = screen.getByRole("button", { name: "Reset kitchen" });
    expect(reset).toHaveClass("demo-banner-reset");
    expect(reset).not.toHaveClass("btn");
    expect(document.getElementById("demo-reset-form")).toBeNull();

    await user.click(reset);
    const dialog = screen.getByRole("dialog", { name: /reset this kitchen/i });
    expect(dialog).toHaveTextContent(/fresh sample kitchen/i);
    expect(dialog).toHaveTextContent(/edits in this demo will be gone/i);
  });

  it("shows an in-app error when reset fails", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: "Could not reset this kitchen. Try again." }),
      })
    );

    render(<DemoBanner />);
    await user.click(screen.getByRole("button", { name: "Reset kitchen" }));
    const dialog = screen.getByRole("dialog", { name: /reset this kitchen/i });
    await user.click(within(dialog).getByRole("button", { name: "Reset kitchen" }));

    expect(await screen.findByText("Could not reset this kitchen. Try again.")).toBeInTheDocument();
    expect(dialog).toHaveTextContent("Could not reset this kitchen. Try again.");
    expect(window.location.pathname).not.toBe("/recipes");
  });
});
