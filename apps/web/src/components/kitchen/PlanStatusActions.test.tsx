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
  });
});
