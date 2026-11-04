import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DocsChrome } from "./DocsChrome";

const secondaryCtaClasses = ["ds-button", "ds-button--secondary", "ds-button--md"] as const;
const defaultCtaClasses = ["ds-button", "ds-button--default", "ds-button--md"] as const;

function expectApiKeyCta(classes: readonly string[]) {
  const cta = screen.getByRole("link", { name: "Get an API key" });
  expect(cta.tagName).toBe("A");
  expect(cta).toHaveAttribute("href", "/#connect");
  expect(cta).toHaveClass(...classes);
  expect(cta).not.toHaveClass("btn");
  expect(cta).not.toHaveClass("primary");
  expect(cta).not.toHaveAttribute("data-slot");
  expect(cta).not.toHaveAttribute("type");
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
}

describe("DocsChrome", () => {
  it("uses a secondary ds-button link for the API key CTA off the connect page", () => {
    render(
      <DocsChrome current="index">
        <p>Body</p>
      </DocsChrome>
    );

    expectApiKeyCta(secondaryCtaClasses);
    const docs = screen.getByRole("link", { name: "Docs" });
    expect(docs).toHaveAttribute("href", "/docs");
    expect(docs).toHaveAttribute("aria-current", "page");
    expect(docs).not.toHaveClass("ds-button");
    expect(screen.getByRole("link", { name: "OvenLovin" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "OvenLovin" })).not.toHaveClass("ds-button");
  });

  it("uses a default ds-button link for the API key CTA on the connect page", () => {
    render(
      <DocsChrome current="connect">
        <p>Body</p>
      </DocsChrome>
    );

    expectApiKeyCta(defaultCtaClasses);
    const connect = screen.getByRole("link", { name: "Connect your agent" });
    expect(connect).toHaveAttribute("href", "/docs/connect-your-agent");
    expect(connect).toHaveAttribute("aria-current", "page");
    expect(connect).not.toHaveClass("ds-button");
  });

  it("keeps the secondary API key CTA on the changelog", () => {
    render(
      <DocsChrome current="changelog">
        <p>Body</p>
      </DocsChrome>
    );

    expectApiKeyCta(secondaryCtaClasses);
    const changelog = screen.getByRole("link", { name: "Changelog" });
    expect(changelog).toHaveAttribute("href", "/changelog");
    expect(changelog).toHaveAttribute("aria-current", "page");
    expect(changelog).not.toHaveClass("ds-button");
  });
});
