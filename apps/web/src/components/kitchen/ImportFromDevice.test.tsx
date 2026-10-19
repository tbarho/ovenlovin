import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ImportFromDevice } from "./ImportFromDevice";

describe("ImportFromDevice", () => {
  it("keeps Safari setup and Advanced collapsed, and hides the add button when unset", () => {
    render(<ImportFromDevice origin="https://ovenlovin-demo.vercel.app" shortcutUrl="" />);

    expect(screen.getByText("Save from Safari on iPhone")).toBeVisible();
    expect(screen.getByText("Advanced")).toBeVisible();
    expect(
      screen.queryByRole("link", { name: "Add the OvenLovin Shortcut" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Save from your browser" })
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/bookmarklet/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/token/i)).not.toBeInTheDocument();
    expect(document.body.textContent).toMatch(/POST that to/);
  });

  it("shows Add the OvenLovin Shortcut when a link is configured", () => {
    render(
      <ImportFromDevice
        origin="https://ovenlovin-demo.vercel.app"
        shortcutUrl="https://www.icloud.com/shortcuts/example"
      />
    );
    const add = screen.getByRole("link", { name: "Add the OvenLovin Shortcut" });
    expect(add).toHaveAttribute("href", "https://www.icloud.com/shortcuts/example");
  });

  it("puts drag and copy code under Advanced", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<ImportFromDevice origin="https://ovenlovin-demo.vercel.app" shortcutUrl="" />);

    await userEvent.click(screen.getByText("Advanced"));
    expect(screen.getByRole("link", { name: "Save to OvenLovin" })).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Copy code" }));
    expect(writeText).toHaveBeenCalled();
    expect(writeText.mock.calls[0]?.[0]).toMatch(/^javascript:/);
    expect(await screen.findByRole("button", { name: "Copied" })).toBeTruthy();
  });
});
