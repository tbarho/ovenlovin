import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { VERCEL_DEPLOY_URL } from "@ovenlovin/brand";
import { DemoBanner } from "./DemoBanner";

describe("DemoBanner", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    window.sessionStorage.clear();
  });

  it("keeps Reset kitchen quiet until confirmed", async () => {
    const user = userEvent.setup();
    render(<DemoBanner />);

    const deploy = screen.getByRole("link", { name: "Deploy your own" });
    expect(deploy).toHaveAttribute("href", VERCEL_DEPLOY_URL);
    expect(deploy).toHaveClass(
      "ds-button",
      "ds-button--default",
      "ds-button--md",
      "demo-banner-cta"
    );
    expect(deploy).not.toHaveClass("btn");

    const dismiss = screen.getByRole("button", { name: "Dismiss" });
    expect(dismiss).toHaveAttribute("data-slot", "button");
    expect(dismiss).toHaveAttribute("data-variant", "tertiary");

    const reset = screen.getByRole("button", { name: "Reset kitchen" });
    expect(reset).toHaveAttribute("data-slot", "button");
    expect(reset).toHaveAttribute("data-variant", "tertiary");
    expect(document.getElementById("demo-reset-form")).toBeNull();

    await user.click(reset);
    const dialog = screen.getByRole("dialog", { name: /reset this kitchen/i });
    expect(dialog).toHaveTextContent(/fresh sample kitchen/i);
    expect(dialog).toHaveTextContent(/edits in this demo will be gone/i);
  });

  it("hides after Dismiss and stays hidden for the session", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<DemoBanner />);

    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByRole("status")).toBeNull();
    expect(window.sessionStorage.getItem("ovenlovin.demo-banner.dismissed")).toBe("1");

    unmount();
    render(<DemoBanner />);
    await waitFor(() => {
      expect(screen.queryByRole("status")).toBeNull();
    });
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

  it("resets the kitchen and redirects to /recipes", async () => {
    const user = userEvent.setup();
    const assign = vi.fn();
    vi.stubGlobal("location", { assign });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({}),
      })
    );

    render(<DemoBanner />);
    await user.click(screen.getByRole("button", { name: "Reset kitchen" }));
    const dialog = screen.getByRole("dialog", { name: /reset this kitchen/i });
    await user.click(within(dialog).getByRole("button", { name: "Reset kitchen" }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith("/api/demo/reset", {
        method: "POST",
        credentials: "include",
      });
    });
    expect(assign).toHaveBeenCalledWith("/recipes");
  });
});
