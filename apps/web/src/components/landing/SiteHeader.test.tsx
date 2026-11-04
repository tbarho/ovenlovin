import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SiteHeader } from "./SiteHeader";

const navCtaClasses = ["ds-button", "ds-button--secondary", "ds-button--md"] as const;

function expectNavCta(element: HTMLElement) {
  expect(element).toHaveClass(...navCtaClasses);
  expect(element).not.toHaveClass("btn");
  expect(element).not.toHaveAttribute("data-slot");
  expect(element).not.toHaveAttribute("type");
}

describe("SiteHeader", () => {
  it("keeps signed-out CTAs as secondary ds-button links", () => {
    render(<SiteHeader signedIn={false} clerkEnabled demoUrl="https://demo.example" />);

    const demo = screen.getByRole("link", { name: "Try the demo" });
    const signIn = screen.getByRole("link", { name: "Sign in" });

    expect(demo.tagName).toBe("A");
    expect(signIn.tagName).toBe("A");
    expect(demo).toHaveAttribute("href", "https://demo.example");
    expect(signIn).toHaveAttribute("href", "/sign-in");
    expectNavCta(demo);
    expectNavCta(signIn);
    expect(screen.queryByRole("link", { name: "Open kitchen" })).not.toBeInTheDocument();
    expect(screen.queryByText("Clerk not configured")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();

    const docs = screen.getByRole("link", { name: "Docs" });
    expect(docs).toHaveAttribute("href", "/docs");
    expect(docs).not.toHaveClass("ds-button");
    expect(screen.getByRole("link", { name: "OvenLovin" })).toHaveAttribute("href", "/");
  });

  it("keeps signed-in CTAs as secondary ds-button links", () => {
    render(<SiteHeader signedIn clerkEnabled demoUrl="https://demo.example" />);

    const demo = screen.getByRole("link", { name: "Try the demo" });
    const kitchen = screen.getByRole("link", { name: "Open kitchen" });

    expect(demo.tagName).toBe("A");
    expect(kitchen.tagName).toBe("A");
    expect(demo).toHaveAttribute("href", "https://demo.example");
    expect(kitchen).toHaveAttribute("href", "/recipes");
    expectNavCta(demo);
    expectNavCta(kitchen);
    expect(screen.queryByRole("link", { name: "Sign in" })).not.toBeInTheDocument();
    expect(screen.queryByText("Clerk not configured")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("keeps Clerk-not-configured as a non-interactive span", () => {
    render(<SiteHeader signedIn={false} clerkEnabled={false} />);

    const notice = screen.getByText("Clerk not configured");
    expect(notice.tagName).toBe("SPAN");
    expect(notice).not.toHaveAttribute("href");
    expectNavCta(notice);
    expect(screen.queryByRole("link", { name: "Sign in" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Open kitchen" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Try the demo" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
