import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/browser-api";
import { PlanStatusActions } from "./PlanStatusActions";

describe("PlanStatusActions", () => {
  beforeEach(() => {
    vi.mocked(api).mockReset();
    vi.mocked(api).mockResolvedValue({ id: "plan-1", status: "approved" });
  });

  it("marks a draft plan final", async () => {
    const user = userEvent.setup();
    render(<PlanStatusActions planId="plan-1" status="draft" />);
    await user.click(screen.getByRole("button", { name: "Mark as final" }));
    expect(api).toHaveBeenCalledWith("/api/v1/meal-plans/plan-1", {
      method: "PATCH",
      body: JSON.stringify({ status: "approved" }),
    });
    expect(screen.queryByRole("button", { name: "Mark as final" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reopen as draft" })).toBeEnabled();
    expect(screen.getByRole("status")).toHaveTextContent("Plan marked as final.");
  });

  it("asks before marking a plan final with an anaphylaxis-risk dinner and pending recheck", async () => {
    const user = userEvent.setup();
    render(
      <PlanStatusActions
        planId="plan-1"
        status="draft"
        needsRecheck
        blockNights={[
          {
            weekday: "Saturday",
            message: "Contains pine nuts, so Child C can't eat this. Anaphylaxis risk.",
          },
        ]}
      />
    );
    await user.click(screen.getByRole("button", { name: "Mark as final" }));
    expect(api).not.toHaveBeenCalled();
    const dialog = screen.getByRole("dialog", { name: /mark this plan as final/i });
    expect(dialog).toHaveTextContent(/still needs a recheck/i);
    expect(dialog).toHaveTextContent(/anaphylaxis-risk dinner/i);

    await user.click(screen.getByRole("button", { name: "Mark as final anyway" }));
    expect(api).toHaveBeenCalledWith("/api/v1/meal-plans/plan-1", {
      method: "PATCH",
      body: JSON.stringify({ status: "approved" }),
    });
    expect(screen.getByRole("button", { name: "Reopen as draft" })).toBeEnabled();
    expect(screen.getByText("Plan marked as final.")).toBeVisible();
  });

  it("clears Saving after a failed mark so the button is not stuck", async () => {
    const user = userEvent.setup();
    vi.mocked(api).mockRejectedValueOnce(new Error("offline"));
    render(<PlanStatusActions planId="plan-1" status="draft" />);
    await user.click(screen.getByRole("button", { name: "Mark as final" }));
    expect(screen.getByText("offline")).toBeVisible();
    expect(screen.getByRole("button", { name: "Mark as final" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Saving…" })).not.toBeInTheDocument();
  });
});
