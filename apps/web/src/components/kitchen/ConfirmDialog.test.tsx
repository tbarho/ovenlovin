import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { ConfirmDialog } from "./ConfirmDialog";

const body = "This replaces your sandbox with a fresh sample kitchen.";

function renderDialog(overrides: Partial<ComponentProps<typeof ConfirmDialog>> = {}) {
  const onCancel = overrides.onCancel ?? vi.fn();
  const onConfirm = overrides.onConfirm ?? vi.fn();
  render(
    <ConfirmDialog
      open
      title="Reset this kitchen?"
      body={body}
      confirmLabel="Reset kitchen"
      onCancel={onCancel}
      onConfirm={onConfirm}
      {...overrides}
    />
  );
  return {
    onCancel,
    onConfirm,
    dialog: screen.getByRole("dialog", { name: "Reset this kitchen?" }),
  };
}

describe("ConfirmDialog", () => {
  it("keeps the BottomSheet shell and uses a default confirm Button with secondary Cancel", async () => {
    const user = userEvent.setup();
    const { onCancel, onConfirm, dialog } = renderDialog();

    expect(dialog).toHaveTextContent(body);
    expect(dialog.querySelector(".sheet-actions")).not.toBeNull();
    expect(dialog.querySelector(".btn")).toBeNull();

    const cancel = within(dialog).getByRole("button", { name: "Cancel" });
    expect(cancel).toHaveAttribute("data-slot", "button");
    expect(cancel).toHaveAttribute("data-variant", "secondary");

    const confirm = within(dialog).getByRole("button", { name: "Reset kitchen" });
    expect(confirm).toHaveAttribute("data-slot", "button");
    expect(confirm).toHaveAttribute("data-variant", "default");

    await user.click(confirm);
    expect(onConfirm).toHaveBeenCalledOnce();
    await user.click(cancel);
    expect(onCancel).toHaveBeenCalled();
  });

  it("uses an error confirm Button when danger", () => {
    const { dialog } = renderDialog({ danger: true });
    expect(within(dialog).getByRole("button", { name: "Reset kitchen" })).toHaveAttribute(
      "data-variant",
      "error"
    );
  });

  it("shows Button loading on confirm and disables Cancel while pending", async () => {
    const user = userEvent.setup();
    const { onCancel, onConfirm, dialog } = renderDialog({ pending: true });

    const confirm = within(dialog).getByRole("button", { name: "Reset kitchen" });
    expect(confirm).toHaveAttribute("aria-busy", "true");
    expect(confirm.querySelector(".ds-button__spinner")).not.toBeNull();
    expect(confirm).not.toHaveTextContent("Working");

    await user.click(confirm);
    expect(onConfirm).not.toHaveBeenCalled();

    const cancel = within(dialog).getByRole("button", { name: "Cancel" });
    expect(cancel).toBeDisabled();
    await user.click(cancel);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("shows a Hint error", () => {
    renderDialog({ error: "Could not reset this kitchen. Try again." });
    const error = screen.getByText("Could not reset this kitchen. Try again.");
    expect(error).toHaveAttribute("data-slot", "hint");
    expect(error).toHaveClass("ds-hint--error");
  });
});
