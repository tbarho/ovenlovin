import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/browser-api";
import { DefaultServingsSettings } from "./DefaultServingsSettings";

describe("DefaultServingsSettings", () => {
  beforeEach(() => {
    vi.mocked(api).mockReset();
    vi.mocked(api).mockResolvedValue({
      mode: "family",
      servings: null,
      familySize: 8,
      defaultCookFor: 8,
    });
  });

  it("loads Match my family as the default and can switch to a fixed number", async () => {
    const user = userEvent.setup();
    render(<DefaultServingsSettings />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Default servings" })).toBeVisible();
    });
    expect(screen.getByRole("radio", { name: /Match my family \(8 people\)/i })).toBeChecked();

    vi.mocked(api).mockResolvedValueOnce({
      mode: "fixed",
      servings: 8,
      familySize: 8,
      defaultCookFor: 8,
    });
    await user.click(screen.getByRole("radio", { name: /A fixed number/i }));
    await waitFor(() => {
      expect(api).toHaveBeenCalledWith("/api/v1/households/settings", {
        method: "PATCH",
        body: JSON.stringify({ mode: "fixed", servings: 8 }),
      });
    });
    expect(await screen.findByTestId("default-servings-saved")).toHaveTextContent("Saved");
    expect(screen.getByRole("status")).toHaveTextContent("Saved");
  });
});
