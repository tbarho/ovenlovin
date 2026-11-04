import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/browser-api";
import { RecheckBanner } from "./RecheckBanner";

describe("RecheckBanner", () => {
  beforeEach(() => {
    vi.mocked(api).mockReset();
    vi.mocked(api).mockResolvedValue({ status: "complete" });
  });

  it("runs a saved recheck so the banner can go away", async () => {
    const user = userEvent.setup();
    render(<RecheckBanner planId="plan-1" />);

    expect(screen.getByRole("status")).toHaveTextContent("This plan needs a recheck");
    const recheck = screen.getByRole("button", { name: "Recheck now" });
    expect(recheck.tagName).toBe("BUTTON");
    expect(recheck).toHaveAttribute("type", "button");
    expect(recheck).toHaveAttribute("data-slot", "button");
    expect(recheck).toHaveAttribute("data-variant", "secondary");
    expect(recheck).toHaveAttribute("data-size", "sm");
    expect(recheck).toHaveClass("ds-button", "ds-button--secondary", "ds-button--sm");
    expect(recheck).not.toHaveClass("btn");
    expect(recheck).not.toHaveClass("compact");
    expect(recheck).not.toHaveAttribute("href");
    expect(recheck).toBeEnabled();
    await user.click(recheck);
    expect(api).toHaveBeenCalledWith("/api/v1/meal-plans/plan-1/check", { method: "POST" });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("disables the recheck button while the check is pending", async () => {
    const user = userEvent.setup();
    let resolveCheck: (value: { status: string }) => void = () => {};
    vi.mocked(api).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCheck = resolve;
        })
    );
    render(<RecheckBanner planId="plan-1" />);
    await user.click(screen.getByRole("button", { name: "Recheck now" }));
    const pending = screen.getByRole("button", { name: "Rechecking…" });
    expect(pending).toBeDisabled();
    expect(pending).toHaveAttribute("data-slot", "button");
    expect(pending).toHaveAttribute("data-variant", "secondary");
    expect(pending).toHaveAttribute("data-size", "sm");
    expect(pending).toHaveClass("ds-button", "ds-button--secondary", "ds-button--sm");
    expect(pending).not.toHaveAttribute("aria-busy");
    expect(pending).not.toHaveAttribute("href");
    expect(api).toHaveBeenCalledTimes(1);
    expect(api).toHaveBeenCalledWith("/api/v1/meal-plans/plan-1/check", { method: "POST" });

    resolveCheck({ status: "complete" });
    await waitFor(() => {
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });
  });

  it("shows the error and re-enables recheck after a failed check", async () => {
    const user = userEvent.setup();
    vi.mocked(api).mockRejectedValueOnce(new Error("offline"));
    render(<RecheckBanner planId="plan-1" nights={["Monday"]} />);
    await user.click(screen.getByRole("button", { name: "Recheck now" }));
    expect(screen.getByRole("status")).toHaveTextContent("offline");
    expect(screen.getByRole("status")).toHaveTextContent(
      "These dinners need a fresh check: Monday."
    );
    const again = screen.getByRole("button", { name: "Recheck now" });
    expect(again).toBeEnabled();
    expect(again).toHaveAttribute("data-variant", "secondary");
    expect(again).toHaveAttribute("data-size", "sm");
    expect(screen.queryByRole("button", { name: "Rechecking…" })).not.toBeInTheDocument();
  });

  it("names the nights that need a fresh check", () => {
    render(<RecheckBanner planId="plan-1" nights={["Monday", "Wednesday"]} />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "These dinners need a fresh check: Monday, Wednesday."
    );
  });

  it("says why when a can't-eat dinner is still on the plan", () => {
    render(
      <RecheckBanner
        planId="plan-1"
        nights={["Saturday"]}
        blockNights={[
          {
            weekday: "Saturday",
            message: "Contains pine nuts, so Child C can't eat this.",
          },
        ]}
      />
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "These dinners need a fresh check: Saturday. Saturday still has a can't-eat dinner."
    );
  });
});
