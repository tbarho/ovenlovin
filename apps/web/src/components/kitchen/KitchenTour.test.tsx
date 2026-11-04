import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it } from "vitest";
import { KitchenTour } from "./KitchenTour";
import { RecipesKitchen } from "./RecipesKitchen";

const STORAGE_KEY = "ovenlovin.first-run-v1";

describe("KitchenTour", () => {
  beforeEach(() => {
    window.localStorage.removeItem(STORAGE_KEY);
  });

  it("shows the start card on first paint so it is visible at phone width", () => {
    render(<RecipesKitchen cookbooks={[]} uncategorized={[]} recipes={[]} />);
    expect(screen.getByRole("region", { name: "Getting started" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Start your kitchen" })).toBeVisible();

    const gotIt = screen.getByRole("button", { name: "Got it" });
    expect(gotIt.tagName).toBe("BUTTON");
    expect(gotIt).toHaveAttribute("type", "button");
    expect(gotIt).toHaveAttribute("data-slot", "button");
    expect(gotIt).toHaveAttribute("data-variant", "secondary");
    expect(gotIt).toHaveAttribute("data-size", "sm");
    expect(gotIt).toHaveClass("ds-button", "ds-button--secondary", "ds-button--sm");
    expect(gotIt).not.toHaveClass("btn");
    expect(gotIt).not.toHaveClass("compact");
    expect(gotIt).not.toHaveAttribute("href");

    const people = screen.getByRole("link", { name: "Add your people" });
    expect(people.tagName).toBe("A");
    expect(people).toHaveAttribute("href", "/people");
    const plan = screen.getByRole("link", { name: "Plan the week" });
    expect(plan.tagName).toBe("A");
    expect(plan).toHaveAttribute("href", "/plans");
  });

  it("paints open, then closes when a dismiss is already saved", () => {
    window.localStorage.setItem(STORAGE_KEY, "1");
    const html = renderToString(<KitchenTour />);
    expect(html).toContain("Getting started");
    expect(html).toContain("Got it");
    expect(html).toContain('href="/people"');
    expect(html).toContain('href="/plans"');

    render(<KitchenTour />);
    expect(screen.queryByRole("region", { name: "Getting started" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Got it" })).not.toBeInTheDocument();
  });

  it("remembers Got it and stays closed on the next visit", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<KitchenTour />);

    await user.click(screen.getByRole("button", { name: "Got it" }));
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("1");
    expect(screen.queryByRole("region", { name: "Getting started" })).not.toBeInTheDocument();

    unmount();
    render(<KitchenTour />);
    expect(screen.queryByRole("region", { name: "Getting started" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Add your people" })).not.toBeInTheDocument();
  });
});
