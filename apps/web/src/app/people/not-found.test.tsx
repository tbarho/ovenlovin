import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import PeopleNotFound from "./not-found";

const backToPeopleClasses = ["ds-button", "ds-button--default", "ds-button--md"] as const;

function expectLinkCta(element: HTMLElement, classes: readonly string[], href: string) {
  expect(element.tagName).toBe("A");
  expect(element).toHaveAttribute("href", href);
  expect(element).toHaveClass(...classes);
  expect(element).not.toHaveClass("btn");
  expect(element).not.toHaveClass("primary");
  expect(element).not.toHaveAttribute("data-slot");
  expect(element).not.toHaveAttribute("type");
}

describe("people not-found", () => {
  it("keeps Back to people as a ds-button link", () => {
    render(<PeopleNotFound />);

    expectLinkCta(
      screen.getByRole("link", { name: "Back to people" }),
      backToPeopleClasses,
      "/people"
    );
    expect(screen.getByRole("heading", { name: "We couldn't find that page" })).toBeInTheDocument();
    expect(
      screen.getByText("It may have been moved, or the link is out of date.")
    ).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
