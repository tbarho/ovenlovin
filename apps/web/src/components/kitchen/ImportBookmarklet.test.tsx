import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ImportBookmarklet } from "./ImportBookmarklet";

describe("ImportBookmarklet", () => {
  it("shows a draggable Save to OvenLovin link and copies the javascript URL", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(<ImportBookmarklet origin="https://ovenlovin-demo.vercel.app" />);
    const link = screen.getByRole("link", { name: "Save to OvenLovin" });
    await waitFor(() => {
      expect(link.getAttribute("href")).toMatch(/^javascript:/);
    });
    expect(decodeURIComponent(link.getAttribute("href") ?? "")).toContain(
      "ovenlovin-demo.vercel.app"
    );
    expect(decodeURIComponent(link.getAttribute("href") ?? "")).toContain(
      "/recipes/import/capture#"
    );

    await userEvent.click(screen.getByRole("button", { name: "Copy code" }));
    expect(writeText).toHaveBeenCalled();
    expect(writeText.mock.calls[0]?.[0]).toMatch(/^javascript:/);
    expect(await screen.findByRole("button", { name: "Copied" })).toBeTruthy();
  });
});
