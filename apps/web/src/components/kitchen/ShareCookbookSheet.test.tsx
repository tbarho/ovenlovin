import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/browser-api", () => ({ api: vi.fn() }));

import { api } from "@/lib/browser-api";
import { ShareCookbookSheet, type CookbookShare } from "./ShareCookbookSheet";

const COOKBOOK = "00000000-0000-4000-8000-0000000000cb";

function renderSheet(share: CookbookShare = { path: null, blocked: null }) {
  const onChange = vi.fn();
  const onClose = vi.fn();
  render(
    <ShareCookbookSheet
      cookbookId={COOKBOOK}
      share={share}
      open
      onClose={onClose}
      onChange={onChange}
    />
  );
  return { onChange, onClose, dialog: screen.getByRole("dialog", { name: "Share book" }) };
}

describe("ShareCookbookSheet", () => {
  beforeEach(() => {
    vi.mocked(api).mockReset();
  });

  it("creates a share link with a default Button", async () => {
    const user = userEvent.setup();
    let resolveShare: (share: CookbookShare) => void = () => undefined;
    vi.mocked(api).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveShare = resolve as (share: CookbookShare) => void;
        })
    );
    const { onChange, dialog } = renderSheet();

    expect(dialog.querySelector(".share-sheet")).not.toBeNull();
    expect(dialog.querySelector(".btn")).toBeNull();
    expect(within(dialog).queryByLabelText("Share link")).toBeNull();

    const create = within(dialog).getByRole("button", { name: "Create link" });
    expect(create).toHaveAttribute("data-slot", "button");
    expect(create).toHaveAttribute("data-variant", "default");
    expect(create).toHaveAttribute("type", "button");

    await user.click(create);
    expect(create).toBeDisabled();
    expect(create).toHaveAttribute("aria-busy", "true");
    expect(create).toHaveAttribute("data-loading", "true");
    expect(create.querySelector(".ds-button__spinner")).not.toBeNull();
    expect(api).toHaveBeenCalledWith(`/api/v1/cookbooks/${COOKBOOK}/share`, { method: "POST" });

    resolveShare({ path: "/read/olbook_abc", blocked: null });
    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith({ path: "/read/olbook_abc", blocked: null })
    );
    expect(create).not.toHaveAttribute("aria-busy");
  });

  it("copies the reader link and stops sharing with a secondary Button", async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    let resolveRevoke: () => void = () => undefined;
    vi.mocked(api).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRevoke = () => resolve(undefined);
        })
    );
    const { onChange, dialog } = renderSheet({ path: "/read/olbook_abc", blocked: null });

    expect(dialog.querySelector(".btn")).toBeNull();
    const link = within(dialog).getByLabelText("Share link");
    expect(link).toHaveValue(`${window.location.origin}/read/olbook_abc`);
    expect(link).toHaveAttribute("readonly");

    const copy = within(dialog).getByRole("button", { name: "Copy link" });
    expect(copy).toHaveAttribute("data-slot", "button");
    expect(copy).toHaveAttribute("data-variant", "default");
    await user.click(copy);
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/read/olbook_abc`);
    expect(within(dialog).getByRole("button", { name: "Copied" })).toBeVisible();

    const revoke = within(dialog).getByRole("button", { name: "Stop sharing" });
    expect(revoke).toHaveAttribute("data-slot", "button");
    expect(revoke).toHaveAttribute("data-variant", "secondary");
    expect(revoke).not.toHaveAttribute("data-loading");

    await user.click(revoke);
    expect(revoke).toBeDisabled();
    expect(revoke).toHaveTextContent("Stopping…");
    expect(revoke).not.toHaveAttribute("aria-busy");
    expect(copy).toBeEnabled();
    expect(api).toHaveBeenCalledWith(`/api/v1/cookbooks/${COOKBOOK}/share`, { method: "DELETE" });

    resolveRevoke();
    await waitFor(() => expect(onChange).toHaveBeenCalledWith({ path: null, blocked: null }));
  });

  it("shows the share error and leaves the sheet open", async () => {
    const user = userEvent.setup();
    vi.mocked(api).mockRejectedValueOnce(new Error("Could not share this book"));
    const { onChange, dialog } = renderSheet();

    await user.click(within(dialog).getByRole("button", { name: "Create link" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Could not share this book");
    expect(onChange).not.toHaveBeenCalled();
    expect(within(dialog).getByRole("button", { name: "Create link" })).toBeEnabled();
  });
});
