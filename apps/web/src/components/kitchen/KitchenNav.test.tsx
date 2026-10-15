import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const pathname = vi.hoisted(() => vi.fn(() => "/recipes"));

vi.mock("next/navigation", () => ({
  usePathname: () => pathname(),
  useRouter: () => ({
    refresh: vi.fn(),
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

import { KitchenNav } from "./KitchenNav";

describe("KitchenNav", () => {
  beforeEach(() => {
    pathname.mockReturnValue("/recipes");
  });

  it("renders desktop links, a sidebar, and a bottom tab bar with the same destinations", () => {
    render(
      <>
        <KitchenNav />
        <KitchenNav variant="sidebar" />
        <KitchenNav variant="tabs" />
      </>
    );

    expect(screen.getAllByRole("link", { name: "Recipes" })).toHaveLength(3);
    expect(screen.getAllByRole("link", { name: "Plan" })).toHaveLength(3);
    expect(screen.getAllByRole("link", { name: "List" })).toHaveLength(3);
    expect(screen.getAllByRole("link", { name: "People" })).toHaveLength(3);
    expect(screen.getAllByRole("link", { name: "Settings" })).toHaveLength(3);
    expect(screen.getAllByRole("navigation", { name: "Kitchen" })).toHaveLength(2);
  });

  it("marks the active kitchen route on both navs", () => {
    pathname.mockReturnValue("/people/abc");
    render(
      <>
        <KitchenNav />
        <KitchenNav variant="sidebar" />
        <KitchenNav variant="tabs" />
      </>
    );

    const people = screen.getAllByRole("link", { name: "People" });
    expect(people).toHaveLength(3);
    expect(people.every((link) => link.getAttribute("aria-current") === "page")).toBe(true);
    expect(
      screen
        .getAllByRole("link", { name: "Recipes" })
        .every((link) => !link.getAttribute("aria-current"))
    ).toBe(true);
  });

  it("shows a loading status on the phone tab bar while a tab switch is pending", async () => {
    const user = userEvent.setup();
    render(<KitchenNav variant="tabs" />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    await user.click(screen.getByRole("link", { name: "Plan" }));
    expect(screen.getByRole("status")).toHaveTextContent("Loading…");
    expect(screen.getByRole("navigation", { name: "Kitchen" })).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("link", { name: "Plan" })).toHaveAttribute("aria-busy", "true");
  });
});
