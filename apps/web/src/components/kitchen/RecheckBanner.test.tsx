import { render, screen } from "@testing-library/react";
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
    await user.click(screen.getByRole("button", { name: "Recheck now" }));
    expect(api).toHaveBeenCalledWith("/api/v1/meal-plans/plan-1/check", { method: "POST" });
  });
});
