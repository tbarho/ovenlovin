import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/browser-api";
import { InviteAccept } from "./InviteAccept";

describe("InviteAccept", () => {
  const assign = vi.fn();

  beforeEach(() => {
    vi.mocked(api).mockReset();
    assign.mockReset();
    vi.stubGlobal("location", { assign });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("joins with the default Button and redirects to /recipes", async () => {
    const user = userEvent.setup();
    vi.mocked(api).mockResolvedValue(undefined);

    render(<InviteAccept token="olinv_abc" householdName="Sample kitchen" />);
    const join = screen.getByRole("button", { name: "Join Sample kitchen" });
    expect(join).toHaveAttribute("data-slot", "button");
    expect(join).toHaveAttribute("data-variant", "default");

    await user.click(join);
    await waitFor(() => {
      expect(api).toHaveBeenCalledWith("/api/v1/invites/olinv_abc/accept", { method: "POST" });
    });
    expect(assign).toHaveBeenCalledWith("/recipes");
  });

  it("shows Button loading, then a Hint error when join fails", async () => {
    const user = userEvent.setup();
    let rejectAccept: (error: Error) => void = () => {};
    vi.mocked(api).mockImplementation(
      () =>
        new Promise((_, reject) => {
          rejectAccept = reject;
        })
    );

    render(<InviteAccept token="olinv_abc" householdName="Sample kitchen" />);
    const join = screen.getByRole("button", { name: "Join Sample kitchen" });
    await user.click(join);

    expect(join).toHaveAttribute("aria-busy", "true");
    expect(join.querySelector(".ds-button__spinner")).not.toBeNull();
    expect(assign).not.toHaveBeenCalled();

    rejectAccept(new Error("This invite is no longer valid"));
    const error = await screen.findByText("This invite is no longer valid");
    expect(error).toHaveAttribute("data-slot", "hint");
    expect(error).toHaveClass("ds-hint--error");
    expect(join).not.toHaveAttribute("aria-busy");
    expect(assign).not.toHaveBeenCalled();
  });
});
