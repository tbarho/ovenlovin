import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.fn();

vi.mock("@clerk/nextjs/server", () => ({
  auth: (...args: unknown[]) => auth(...args),
}));

import NotFound from "./not-found";

const navCtaClasses = ["ds-button", "ds-button--secondary", "ds-button--md"] as const;
const homeCtaClasses = ["ds-button", "ds-button--default", "ds-button--md"] as const;

function expectLinkCta(element: HTMLElement, classes: readonly string[], href: string) {
  expect(element.tagName).toBe("A");
  expect(element).toHaveAttribute("href", href);
  expect(element).toHaveClass(...classes);
  expect(element).not.toHaveClass("btn");
  expect(element).not.toHaveClass("primary");
  expect(element).not.toHaveAttribute("data-slot");
  expect(element).not.toHaveAttribute("type");
}

describe("root not-found", () => {
  beforeEach(() => {
    auth.mockReset();
    vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "pk_test");
  });

  it("shows Open kitchen when Clerk auth has a userId", async () => {
    auth.mockResolvedValue({ userId: "user_1" });
    render(await NotFound());

    expectLinkCta(screen.getByRole("link", { name: "Docs" }), navCtaClasses, "/docs");
    expectLinkCta(screen.getByRole("link", { name: "Open kitchen" }), navCtaClasses, "/recipes");
    expectLinkCta(screen.getByRole("link", { name: "Back home" }), homeCtaClasses, "/");
    expect(screen.queryByRole("link", { name: "Sign in" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("shows Sign in when Clerk auth has no userId", async () => {
    auth.mockResolvedValue({ userId: null });
    render(await NotFound());

    expectLinkCta(screen.getByRole("link", { name: "Docs" }), navCtaClasses, "/docs");
    expectLinkCta(screen.getByRole("link", { name: "Sign in" }), navCtaClasses, "/sign-in");
    expectLinkCta(screen.getByRole("link", { name: "Back home" }), homeCtaClasses, "/");
    expect(screen.queryByRole("link", { name: "Open kitchen" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("hides kitchen and sign-in when Clerk is not configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "");
    render(await NotFound());

    expectLinkCta(screen.getByRole("link", { name: "Docs" }), navCtaClasses, "/docs");
    expectLinkCta(screen.getByRole("link", { name: "Back home" }), homeCtaClasses, "/");
    expect(screen.queryByRole("link", { name: "Open kitchen" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Sign in" })).not.toBeInTheDocument();
    expect(auth).not.toHaveBeenCalled();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
