import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/browser-api";
import { KitchenNameSettings } from "./KitchenNameSettings";

describe("KitchenNameSettings", () => {
  beforeEach(() => {
    vi.mocked(api).mockReset();
  });

  it("lets an owner rename the kitchen inline", async () => {
    const user = userEvent.setup();
    vi.mocked(api).mockImplementation(async (_path, init) => {
      if (init?.method === "PATCH") {
        return { name: "Weeknight kitchen" };
      }
      return { name: "Sample kitchen" };
    });

    render(<KitchenNameSettings canRename />);
    const input = await screen.findByLabelText("Name");
    expect(input).toHaveValue("Sample kitchen");

    await user.clear(input);
    await user.type(input, "Weeknight kitchen");
    await user.click(screen.getByRole("button", { name: "Save name" }));

    await waitFor(() => {
      expect(api).toHaveBeenCalledWith("/api/v1/households", {
        method: "PATCH",
        body: JSON.stringify({ name: "Weeknight kitchen" }),
      });
    });
    expect(input).toHaveValue("Weeknight kitchen");
    expect(await screen.findByTestId("kitchen-name-saved")).toHaveTextContent("Saved");
    expect(screen.getByRole("status")).toHaveTextContent("Saved");
  });

  it("shows the name as text when the viewer cannot rename", async () => {
    vi.mocked(api).mockResolvedValue({ name: "Parent A Kitchen" });
    render(<KitchenNameSettings canRename={false} />);
    expect(await screen.findByText("Parent A Kitchen")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Save name" })).toBeNull();
  });
});
