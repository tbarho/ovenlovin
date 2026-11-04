import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/browser-api";
import { KitchenMembers } from "./KitchenMembers";

const owner = {
  membershipId: "m1",
  userId: "user-a",
  email: "parent-a@example.com",
  displayName: "Parent A",
  role: "owner" as const,
  createdAt: "2026-10-01T00:00:00.000Z",
};

const joiner = {
  membershipId: "m2",
  userId: "user-b",
  email: "parent-b@example.com",
  displayName: "Parent B",
  role: "member" as const,
  createdAt: "2026-10-19T00:00:00.000Z",
};

describe("KitchenMembers", () => {
  beforeEach(() => {
    vi.mocked(api).mockReset();
  });

  it("shows a newly joined member after a refresh without a full reload", async () => {
    let items: (typeof owner)[] | Array<typeof owner | typeof joiner> = [owner];
    vi.mocked(api).mockImplementation(async () => ({ items }));

    render(<KitchenMembers currentUserId="user-a" currentRole="owner" />);
    expect(await screen.findByText("Parent A")).toBeVisible();
    expect(screen.queryByText("Parent B")).toBeNull();

    items = [owner, joiner];
    document.dispatchEvent(new Event("visibilitychange"));

    expect(await screen.findByText("Parent B")).toBeVisible();
  });

  it("uses email when two members share the same display name", async () => {
    const user = userEvent.setup();
    vi.mocked(api).mockResolvedValue({
      items: [
        { ...owner, displayName: "Demo visitor" },
        { ...joiner, displayName: "Demo visitor" },
      ],
    });
    render(<KitchenMembers currentUserId="user-a" currentRole="owner" />);
    expect(await screen.findByText("parent-a@example.com")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Remove" }));
    expect(screen.getByText("Remove parent-b@example.com from this kitchen?")).toBeVisible();
  });

  it("uses an inline confirm instead of the browser dialog to remove a member", async () => {
    const user = userEvent.setup();
    vi.mocked(api).mockResolvedValue({ items: [owner, joiner] });
    const confirmSpy = vi.spyOn(window, "confirm");

    render(<KitchenMembers currentUserId="user-a" currentRole="owner" />);
    const remove = await screen.findByRole("button", { name: "Remove" });
    expect(remove).toHaveAttribute("data-slot", "button");
    expect(remove).toHaveAttribute("data-variant", "tertiary");
    await user.click(remove);

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Remove member?" })).toBeVisible();
    expect(screen.getByText("Remove Parent B from this kitchen?")).toBeVisible();
  });

  it("changes a role through Select with Title Case labels and lowercase values", async () => {
    const user = userEvent.setup();
    vi.mocked(api).mockImplementation(async (_path, init) => {
      if (init?.method === "PATCH") return joiner;
      return { items: [owner, joiner] };
    });

    render(<KitchenMembers currentUserId="user-a" currentRole="owner" />);
    const role = await screen.findByLabelText("Role for Parent B");
    expect(role.tagName).toBe("SELECT");
    expect(role).toHaveAttribute("data-slot", "select");
    expect(role).toHaveValue("member");
    const options = within(role).getAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual([
      "Owner",
      "Admin",
      "Member",
      "Viewer",
    ]);
    expect(options.map((option) => (option as HTMLOptionElement).value)).toEqual([
      "owner",
      "admin",
      "member",
      "viewer",
    ]);

    await user.selectOptions(role, "admin");
    await waitFor(() => {
      expect(api).toHaveBeenCalledWith("/api/v1/households/members/user-b", {
        method: "PATCH",
        body: JSON.stringify({ role: "admin" }),
      });
    });
  });

  it("shows a Hint error when members fail to load", async () => {
    vi.mocked(api).mockRejectedValue(new Error("Could not load kitchen members"));

    render(<KitchenMembers currentUserId="user-a" currentRole="owner" />);
    const error = await screen.findByText("Could not load kitchen members");
    expect(error).toHaveAttribute("data-slot", "hint");
    expect(error).toHaveClass("ds-hint--error");
  });

  it("shows a Badge role and Leave for a member who cannot manage", async () => {
    vi.mocked(api).mockResolvedValue({ items: [owner, joiner] });

    render(<KitchenMembers currentUserId="user-b" currentRole="member" />);
    expect(await screen.findByText("Parent B")).toBeVisible();

    const ownerBadge = screen.getByText("Owner").closest("[data-slot='badge']");
    expect(ownerBadge).toHaveAttribute("data-variant", "neutral");
    const memberBadge = screen.getByText("Member").closest("[data-slot='badge']");
    expect(memberBadge).toHaveAttribute("data-variant", "neutral");

    expect(screen.queryByLabelText("Role for Parent A")).toBeNull();
    expect(screen.queryByRole("button", { name: "Remove" })).toBeNull();

    const leave = screen.getByRole("button", { name: "Leave This Kitchen" });
    expect(leave).toHaveAttribute("data-slot", "button");
    expect(leave).toHaveAttribute("data-variant", "tertiary");
  });
});
