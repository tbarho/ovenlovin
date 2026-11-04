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
    expect(link.tagName).toBe("A");
    expect(link).toHaveClass("ds-button", "ds-button--default", "ds-button--md");
    expect(link).not.toHaveClass("btn");
    await waitFor(() => {
      expect(link.getAttribute("href")).toMatch(/^javascript:/);
    });
    expect(decodeURIComponent(link.getAttribute("href") ?? "")).toContain(
      "ovenlovin-demo.vercel.app"
    );
    expect(decodeURIComponent(link.getAttribute("href") ?? "")).toContain(
      "/recipes/import/capture#"
    );

    const copy = screen.getByRole("button", { name: "Copy code" });
    expect(copy.tagName).toBe("BUTTON");
    expect(copy).toHaveAttribute("data-slot", "button");
    expect(copy).toHaveAttribute("data-variant", "secondary");
    expect(copy).toHaveAttribute("data-size", "md");
    expect(copy).toHaveClass("ds-button", "ds-button--secondary", "ds-button--md");
    expect(copy).not.toHaveClass("btn");
    expect(document.querySelector(".import-advanced .btn")).toBeNull();

    await userEvent.click(copy);
    expect(writeText).toHaveBeenCalled();
    expect(writeText.mock.calls[0]?.[0]).toMatch(/^javascript:/);
    const copied = await screen.findByRole("button", { name: "Copied" });
    expect(copied).toHaveAttribute("data-variant", "secondary");
    expect(link.getAttribute("href")).toMatch(/^javascript:/);
  });
});
