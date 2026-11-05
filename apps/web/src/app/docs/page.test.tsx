import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: async () =>
    new Headers({
      host: "ovenlovin.test",
      "x-forwarded-proto": "https",
    }),
}));

import DocsIndexPage from "./page";

const connectCtaClasses = ["ds-button", "ds-button--default", "ds-button--md"] as const;
const llmsCtaClasses = ["ds-button", "ds-button--secondary", "ds-button--md"] as const;
const referenceCtaClasses = ["ds-button", "ds-button--tertiary", "ds-button--md"] as const;

function expectLinkCta(element: Element, classes: readonly string[], href: string) {
  expect(element.tagName).toBe("A");
  expect(element).toHaveAttribute("href", href);
  expect(element).toHaveClass(...classes);
  expect(element).not.toHaveClass("btn");
  expect(element).not.toHaveClass("primary");
  expect(element).not.toHaveClass("ghost");
  expect(element).not.toHaveAttribute("data-slot");
  expect(element).not.toHaveAttribute("type");
}

describe("docs index", () => {
  it("keeps hero CTAs as ds-button links", async () => {
    render(await DocsIndexPage());

    const hero = document.querySelector(".docs-page .hero-ctas");
    const ctas = hero?.querySelectorAll("a");
    expect(ctas).toHaveLength(3);
    const connect = ctas?.[0];
    const llms = ctas?.[1];
    const reference = ctas?.[2];
    expect(connect).toBeTruthy();
    expect(llms).toBeTruthy();
    expect(reference).toBeTruthy();
    if (!connect || !llms || !reference) return;

    expectLinkCta(connect, connectCtaClasses, "/docs/connect-your-agent");
    expect(connect).toHaveTextContent("Connect your agent");
    expectLinkCta(llms, llmsCtaClasses, "/llms.txt");
    expect(llms).toHaveTextContent("llms.txt");
    expect(llms).not.toHaveAttribute("rel");
    expectLinkCta(reference, referenceCtaClasses, "https://tbarho.github.io/ovenlovin/");
    expect(reference).toHaveAttribute("rel", "noreferrer");
    expect(reference).not.toHaveAttribute("target");
    expect(reference).toHaveTextContent("Full reference");

    expect(hero?.querySelector("button")).toBeNull();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
