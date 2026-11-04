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
    expect(input).toHaveAttribute("data-slot", "input");
    expect(input).toHaveAttribute("maxLength", "255");
    expect(screen.getByText("Name").closest("[data-slot='field']")).toHaveClass("ds-field");
    const save = screen.getByRole("button", { name: "Save Name" });
    expect(save).toHaveAttribute("data-slot", "button");
    expect(save).toHaveAttribute("data-variant", "default");
    expect(save).toBeDisabled();

    await user.clear(input);
    await user.type(input, "Weeknight kitchen");
    expect(save).toBeEnabled();
    await user.click(save);

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

  it("shows a Field error when rename fails", async () => {
    const user = userEvent.setup();
    vi.mocked(api).mockImplementation(async (_path, init) => {
      if (init?.method === "PATCH") {
        throw new Error("Could not rename this kitchen");
      }
      return { name: "Sample kitchen" };
    });

    render(<KitchenNameSettings canRename />);
    const input = await screen.findByLabelText("Name");
    await user.clear(input);
    await user.type(input, "Weeknight kitchen");
    await user.click(screen.getByRole("button", { name: "Save Name" }));

    const error = await screen.findByText("Could not rename this kitchen");
    expect(error).toHaveAttribute("data-slot", "hint");
    expect(error).toHaveClass("ds-hint--error");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby", error.id);
    expect(screen.queryByTestId("kitchen-name-saved")).not.toBeInTheDocument();
  });

  it("shows the name as text when the viewer cannot rename", async () => {
    vi.mocked(api).mockResolvedValue({ name: "Parent A Kitchen" });
    render(<KitchenNameSettings canRename={false} />);
    expect(await screen.findByText("Parent A Kitchen")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Save Name" })).toBeNull();
    expect(screen.queryByLabelText("Name")).toBeNull();
  });
});
