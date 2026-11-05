import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/browser-api";
import { KitchenInvites } from "./KitchenInvites";

const pendingInvite = {
  id: "inv_1",
  token: "olinv_abc",
  url: "http://127.0.0.1:3100/invite/olinv_abc",
  role: "member" as const,
  expiresAt: "2026-10-26T17:00:00.000Z",
  createdAt: "2026-10-19T17:00:00.000Z",
};

describe("KitchenInvites", () => {
  beforeEach(() => {
    vi.mocked(api).mockReset();
    HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  it("shows the copy action next to the create control", async () => {
    const user = userEvent.setup();
    vi.mocked(api).mockImplementation(async (_path, init) => {
      if (init?.method === "POST") return pendingInvite;
      return { items: init?.method === "POST" ? [pendingInvite] : [] };
    });

    render(<KitchenInvites canManage />);
    await waitFor(() => {
      expect(screen.getByText("No pending invite links.")).toBeVisible();
    });

    const role = screen.getByLabelText("Role");
    expect(role.tagName).toBe("SELECT");
    expect(role).toHaveAttribute("data-slot", "select");
    expect(role).toHaveValue("member");
    expect(screen.getByText("Role").closest("[data-slot='field']")).toHaveClass("ds-field");
    const expires = screen.getByLabelText("Expires In Days");
    expect(expires).toHaveAttribute("data-slot", "input");
    expect(expires).toHaveAttribute("type", "number");
    expect(expires).toHaveValue(7);
    const create = screen.getByRole("button", { name: "Create Invite Link" });
    expect(create).toHaveAttribute("data-slot", "button");
    expect(create).toHaveAttribute("data-variant", "default");

    await user.click(create);
    await waitFor(() => {
      expect(api).toHaveBeenCalledWith("/api/v1/households/invites", {
        method: "POST",
        body: JSON.stringify({ role: "member", expiresInDays: 7 }),
      });
    });
    const created = await screen.findByTestId("invite-created");
    expect(within(created).getByText("Copy this link and send it yourself.")).toBeVisible();
    expect(within(created).getByRole("button", { name: "Copy" })).toBeVisible();
  });

  it("shows a Hint error when creating an invite fails", async () => {
    const user = userEvent.setup();
    vi.mocked(api).mockImplementation(async (_path, init) => {
      if (init?.method === "POST") {
        throw new Error("Could not create an invite");
      }
      return { items: [] };
    });

    render(<KitchenInvites canManage />);
    await waitFor(() => {
      expect(screen.getByText("No pending invite links.")).toBeVisible();
    });

    await user.click(screen.getByRole("button", { name: "Create Invite Link" }));
    const error = await screen.findByText("Could not create an invite");
    expect(error).toHaveAttribute("data-slot", "hint");
    expect(error).toHaveClass("ds-hint--error");
    expect(screen.queryByTestId("invite-created")).not.toBeInTheDocument();
  });

  it("shows the empty invite state in the panel after revoke succeeds", async () => {
    const user = userEvent.setup();
    let items: (typeof pendingInvite)[] = [];
    let holdReload: Promise<void> | undefined;
    let releaseReload: (() => void) | undefined;
    const confirmSpy = vi.spyOn(window, "confirm");

    vi.mocked(api).mockImplementation(async (path, init) => {
      if (init?.method === "POST") {
        items = [pendingInvite];
        return pendingInvite;
      }
      if (init?.method === "DELETE") {
        items = [];
        holdReload = new Promise<void>((resolve) => {
          releaseReload = resolve;
        });
        return pendingInvite;
      }
      if (holdReload) {
        await holdReload;
      }
      return { items };
    });

    render(<KitchenInvites canManage />);
    await waitFor(() => {
      expect(screen.getByText("No pending invite links.")).toBeVisible();
    });

    await user.click(screen.getByRole("button", { name: "Create Invite Link" }));
    await waitFor(() => {
      const revoke = screen.getByRole("button", { name: "Revoke" });
      expect(revoke).toBeVisible();
      expect(revoke).toHaveAttribute("data-slot", "button");
      expect(revoke).toHaveAttribute("data-variant", "tertiary");
    });

    await user.click(screen.getByRole("button", { name: "Revoke" }));
    expect(confirmSpy).not.toHaveBeenCalled();
    const dialog = screen.getByRole("dialog", { name: "Revoke invite?" });
    await user.click(within(dialog).getByRole("button", { name: "Revoke link" }));
    await waitFor(() => {
      expect(screen.getByText("No pending invite links.")).toBeVisible();
    });
    expect(screen.queryByRole("button", { name: /Revoke/ })).toBeNull();
    expect(screen.queryByText("Copy this link and send it yourself.")).toBeNull();

    releaseReload?.();
    await waitFor(() => {
      expect(screen.getByText("No pending invite links.")).toBeVisible();
    });
  });
});
