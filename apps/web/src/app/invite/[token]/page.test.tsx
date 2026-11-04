import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const previewInvite = vi.hoisted(() => vi.fn());
const getSessionContext = vi.hoisted(() => vi.fn());
const isDemoModeEnabled = vi.hoisted(() => vi.fn(() => false));

vi.mock("@ovenlovin/db", () => ({
  getDatabase: () => ({}),
}));

vi.mock("@/lib/session", () => ({
  getSessionContext: (...args: unknown[]) => getSessionContext(...args),
}));

vi.mock("@/lib/demo/mode", () => ({
  isDemoModeEnabled: () => isDemoModeEnabled(),
}));

vi.mock("@ovenlovin/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@ovenlovin/core")>();
  return {
    ...actual,
    InviteService: class {
      previewInvite(token: string) {
        return previewInvite(token);
      }
    },
  };
});

import InvitePage from "./page";

const TOKEN = `olinv_${"ab".repeat(16)}`;
const returnTo = `/invite/${TOKEN}`;

const secondaryCtaClasses = ["ds-button", "ds-button--secondary", "ds-button--md"] as const;
const primaryCtaClasses = ["ds-button", "ds-button--default", "ds-button--md"] as const;

const pendingPreview = {
  householdId: "11111111-1111-4111-8111-111111111111",
  householdName: "Household 1",
  role: "member" as const,
  expiresAt: "2026-12-01T00:00:00.000Z",
  status: "pending" as const,
};

function expectLinkCta(element: HTMLElement, classes: readonly string[], href: string) {
  expect(element.tagName).toBe("A");
  expect(element).toHaveAttribute("href", href);
  expect(element).toHaveClass(...classes);
  expect(element).not.toHaveClass("btn");
  expect(element).not.toHaveClass("primary");
  expect(element).not.toHaveAttribute("data-slot");
  expect(element).not.toHaveAttribute("type");
}

function renderInvite(token: string) {
  return InvitePage({ params: Promise.resolve({ token }) });
}

describe("invite page", () => {
  beforeEach(() => {
    previewInvite.mockReset();
    getSessionContext.mockReset();
    isDemoModeEnabled.mockReset();
    isDemoModeEnabled.mockReturnValue(false);
  });

  it("shows Back home when the token is invalid", async () => {
    render(await renderInvite("not-an-invite"));

    expectLinkCta(screen.getByRole("link", { name: "Back home" }), secondaryCtaClasses, "/");
    expect(screen.getByRole("heading", { name: "Invite not found" })).toBeInTheDocument();
    expect(previewInvite).not.toHaveBeenCalled();
    expect(getSessionContext).not.toHaveBeenCalled();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "OvenLovin" })).not.toHaveClass("ds-button");
  });

  it("shows Back home when the invite is missing", async () => {
    previewInvite.mockResolvedValue(null);
    render(await renderInvite(TOKEN));

    expectLinkCta(screen.getByRole("link", { name: "Back home" }), secondaryCtaClasses, "/");
    expect(screen.getByRole("heading", { name: "Invite not found" })).toBeInTheDocument();
    expect(previewInvite).toHaveBeenCalledWith(TOKEN);
    expect(getSessionContext).not.toHaveBeenCalled();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("shows Back home when the invite is revoked or expired", async () => {
    previewInvite.mockResolvedValue({
      ...pendingPreview,
      status: "revoked",
    });
    const { unmount } = render(await renderInvite(TOKEN));

    expectLinkCta(screen.getByRole("link", { name: "Back home" }), secondaryCtaClasses, "/");
    expect(screen.getByText("Household 1 revoked this link.")).toBeInTheDocument();
    expect(getSessionContext).not.toHaveBeenCalled();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    unmount();

    previewInvite.mockResolvedValue({
      ...pendingPreview,
      status: "expired",
    });
    render(await renderInvite(TOKEN));

    expectLinkCta(screen.getByRole("link", { name: "Back home" }), secondaryCtaClasses, "/");
    expect(screen.getByText("This link for Household 1 has expired.")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("keeps sign-in and create-account as ds-button links", async () => {
    previewInvite.mockResolvedValue(pendingPreview);
    getSessionContext.mockResolvedValue({ userId: null });
    render(await renderInvite(TOKEN));

    expectLinkCta(
      screen.getByRole("link", { name: "Sign in to join" }),
      primaryCtaClasses,
      `/sign-in?redirect_url=${encodeURIComponent(returnTo)}`
    );
    expectLinkCta(
      screen.getByRole("link", { name: "Create an account" }),
      secondaryCtaClasses,
      `/sign-up?redirect_url=${encodeURIComponent(returnTo)}`
    );
    expect(screen.queryByRole("link", { name: "Enter demo to join" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(getSessionContext).toHaveBeenCalledWith({ allowRedirect: false });
  });

  it("keeps enter demo as a ds-button link", async () => {
    previewInvite.mockResolvedValue(pendingPreview);
    getSessionContext.mockResolvedValue(null);
    isDemoModeEnabled.mockReturnValue(true);
    render(await renderInvite(TOKEN));

    expectLinkCta(
      screen.getByRole("link", { name: "Enter demo to join" }),
      primaryCtaClasses,
      `/api/demo/enter?next=${encodeURIComponent(returnTo)}`
    );
    expect(screen.queryByRole("link", { name: "Sign in to join" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Create an account" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("leaves accept on InviteAccept when a session exists", async () => {
    previewInvite.mockResolvedValue(pendingPreview);
    getSessionContext.mockResolvedValue({ userId: "user_1" });
    isDemoModeEnabled.mockReturnValue(true);
    render(await renderInvite(TOKEN));

    expect(screen.getByRole("button", { name: "Join Household 1" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Sign in to join" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Create an account" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Enter demo to join" })).not.toBeInTheDocument();
    expect(isDemoModeEnabled).not.toHaveBeenCalled();
  });
});
