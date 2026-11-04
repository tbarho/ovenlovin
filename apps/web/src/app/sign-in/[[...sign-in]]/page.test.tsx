import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: async () =>
    new Headers({
      host: "ovenlovin.test",
      "x-forwarded-proto": "https",
    }),
}));

vi.mock("@clerk/nextjs", () => ({
  SignIn: ({ fallbackRedirectUrl }: { fallbackRedirectUrl?: string }) => (
    <div data-testid="clerk-sign-in">{fallbackRedirectUrl}</div>
  ),
}));

import SignInPage from "./page";

const unavailableCtaClasses = ["ds-button", "ds-button--default", "ds-button--md"] as const;

function expectLinkCta(element: HTMLElement, classes: readonly string[], href: string) {
  expect(element.tagName).toBe("A");
  expect(element).toHaveAttribute("href", href);
  expect(element).toHaveClass(...classes);
  expect(element).not.toHaveClass("btn");
  expect(element).not.toHaveClass("primary");
  expect(element).not.toHaveAttribute("data-slot");
  expect(element).not.toHaveAttribute("type");
}

function renderSignIn(redirectUrl?: string) {
  return SignInPage({
    searchParams: Promise.resolve(redirectUrl ? { redirect_url: redirectUrl } : {}),
  });
}

describe("sign-in page", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "");
    vi.stubEnv("OVENLOVIN_DEMO_MODE", "");
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("VERCEL_ENV", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("keeps the unavailable CTA as a ds-button link back home", async () => {
    render(await renderSignIn());

    expectLinkCta(screen.getByRole("link", { name: "Back home" }), unavailableCtaClasses, "/");
    expect(screen.getByRole("heading", { name: "Sign-in isn't set up yet" })).toBeInTheDocument();
    expect(
      screen.getByText(
        "This kitchen isn't accepting accounts on this deploy. Go back to the kitchen, or ask the host to finish setup."
      )
    ).toBeInTheDocument();
    expect(screen.queryByTestId("clerk-sign-in")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "OvenLovin" })).not.toHaveClass("ds-button");
  });

  it("keeps the demo unavailable CTA as a ds-button link back to recipes", async () => {
    vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "pk_test");
    vi.stubEnv("OVENLOVIN_DEMO_MODE", "1");
    render(await renderSignIn("/people"));

    expectLinkCta(
      screen.getByRole("link", { name: "Back to recipes" }),
      unavailableCtaClasses,
      "/api/demo/enter?next=%2Frecipes"
    );
    expect(
      screen.getByRole("heading", { name: "Sign-in isn't available in the demo" })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "This sandbox is already open. You can go back to the kitchen without creating an account."
      )
    ).toBeInTheDocument();
    expect(screen.queryByTestId("clerk-sign-in")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders Clerk SignIn with the safe redirect when accounts are configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "pk_test");
    render(await renderSignIn("/people"));

    expect(screen.getByTestId("clerk-sign-in")).toHaveTextContent("/people");
    expect(screen.queryByRole("link", { name: "Back home" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Back to recipes" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
