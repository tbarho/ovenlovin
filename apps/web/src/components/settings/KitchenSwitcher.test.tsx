import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/browser-api";
import { KitchenSwitcher } from "./KitchenSwitcher";

describe("KitchenSwitcher", () => {
  beforeEach(() => {
    vi.mocked(api).mockReset();
  });

  it("hides until the user belongs to more than one kitchen", async () => {
    vi.mocked(api).mockResolvedValue({
      items: [{ household: { id: "k1", name: "Kitchen A" }, membership: { role: "owner" } }],
      activeHouseholdId: "k1",
    });
    const { container } = render(<KitchenSwitcher />);
    await waitFor(() => {
      expect(api).toHaveBeenCalled();
    });
    expect(container).toBeEmptyDOMElement();
  });

  it("lists kitchens when the user belongs to more than one", async () => {
    vi.mocked(api).mockResolvedValue({
      items: [
        { household: { id: "k1", name: "Kitchen A" }, membership: { role: "owner" } },
        { household: { id: "k2", name: "Kitchen B" }, membership: { role: "member" } },
      ],
      activeHouseholdId: "k1",
    });
    render(<KitchenSwitcher />);
    expect(await screen.findByLabelText("Active kitchen")).toBeVisible();
    expect(screen.getByRole("option", { name: "Kitchen A" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Kitchen B" })).toBeInTheDocument();
  });
});
