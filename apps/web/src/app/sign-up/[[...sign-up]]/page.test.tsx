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
  SignUp: ({ fallbackRedirectUrl }: { fallbackRedirectUrl?: string }) => (
    <div data-testid="clerk-sign-up">{fallbackRedirectUrl}</div>
  ),
}));

import SignUpPage from "./page";

const unavailableCtaClasses = ["ds-button", "ds-button--default", "ds-button--md"] as const;
const inviteToken = `olinv_${"ab".repeat(16)}`;

function expectLinkCta(element: HTMLElement, classes: readonly string[], href: string) {
  expect(element.tagName).toBe("A");
  expect(element).toHaveAttribute("href", href);
  expect(element).toHaveClass(...classes);
  expect(element).not.toHaveClass("btn");
  expect(element).not.toHaveClass("primary");
  expect(element).not.toHaveAttribute("data-slot");
  expect(element).not.toHaveAttribute("type");
}

function renderSignUp(redirectUrl?: string) {
  return SignUpPage({
    searchParams: Promise.resolve(redirectUrl ? { redirect_url: redirectUrl } : {}),
  });
}

describe("sign-up page", () => {
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
    render(await renderSignUp());

    expectLinkCta(screen.getByRole("link", { name: "Back home" }), unavailableCtaClasses, "/");
    expect(screen.getByRole("heading", { name: "Sign-in isn't set up yet" })).toBeInTheDocument();
    expect(
      screen.getByText(
        "This kitchen isn't accepting accounts on this deploy. Go back to the kitchen, or ask the host to finish setup."
      )
    ).toBeInTheDocument();
    expect(screen.queryByText("Join this kitchen")).not.toBeInTheDocument();
    expect(screen.queryByTestId("clerk-sign-up")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "OvenLovin" })).not.toHaveClass("ds-button");
  });

  it("keeps the demo unavailable CTA as a ds-button link back to recipes", async () => {
    vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "pk_test");
    vi.stubEnv("OVENLOVIN_DEMO_MODE", "1");
    render(await renderSignUp(`/invite/${inviteToken}`));

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
    expect(screen.queryByText("Join this kitchen")).not.toBeInTheDocument();
    expect(screen.queryByTestId("clerk-sign-up")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders Clerk SignUp with the join note when the redirect is an invite", async () => {
    vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "pk_test");
    render(await renderSignUp(`/invite/${inviteToken}`));

    expect(screen.getByTestId("clerk-sign-up")).toHaveTextContent(`/invite/${inviteToken}`);
    expect(screen.getByText("Join this kitchen")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Back home" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Back to recipes" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders Clerk SignUp without the join note for a kitchen path", async () => {
    vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "pk_test");
    render(await renderSignUp("/people"));

    expect(screen.getByTestId("clerk-sign-up")).toHaveTextContent("/people");
    expect(screen.queryByText("Join this kitchen")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Back home" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Back to recipes" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
