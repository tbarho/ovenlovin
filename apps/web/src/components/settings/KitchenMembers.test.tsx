import { render, screen, waitFor } from "@testing-library/react";
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

  it("uses an inline confirm instead of the browser dialog to remove a member", async () => {
    const user = userEvent.setup();
    vi.mocked(api).mockResolvedValue({ items: [owner, joiner] });
    const confirmSpy = vi.spyOn(window, "confirm");

    render(<KitchenMembers currentUserId="user-a" currentRole="owner" />);
    await user.click(await screen.findByRole("button", { name: "Remove" }));

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Remove member?" })).toBeVisible();
    expect(screen.getByText("Remove Parent B from this kitchen?")).toBeVisible();
  });
});
