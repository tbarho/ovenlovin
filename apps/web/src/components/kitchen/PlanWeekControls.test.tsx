import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/browser-api";
import { PlanWeekControls } from "./PlanWeekControls";

describe("PlanWeekControls", () => {
  beforeEach(() => {
    vi.mocked(api).mockReset();
    vi.mocked(api).mockResolvedValue({ id: "plan-1" });
  });

  it("pages weeks and can mark a draft as final", async () => {
    const user = userEvent.setup();
    render(<PlanWeekControls weekStart="2026-10-12" planId="plan-1" status="draft" />);

    expect(screen.getByRole("link", { name: "Previous week" })).toHaveAttribute(
      "href",
      "/plans?week=2026-10-05"
    );
    expect(screen.getByRole("link", { name: "Next week" })).toHaveAttribute(
      "href",
      "/plans?week=2026-10-19"
    );

    await user.click(screen.getByRole("button", { name: "Mark as final" }));
    expect(api).toHaveBeenCalledWith("/api/v1/meal-plans/plan-1", {
      method: "PATCH",
      body: JSON.stringify({ status: "approved" }),
    });
  });
});
