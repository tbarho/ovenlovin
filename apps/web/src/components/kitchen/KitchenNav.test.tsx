import { render, screen } from "@testing-library/react";
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

  it("renders desktop links and a bottom tab bar with the same destinations", () => {
    render(
      <>
        <KitchenNav />
        <KitchenNav variant="tabs" />
      </>
    );

    expect(screen.getAllByRole("link", { name: "Recipes" })).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: "People" })).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: "Settings" })).toHaveLength(2);
    expect(screen.getByRole("navigation", { name: "Kitchen" })).toBeInTheDocument();
  });

  it("marks the active kitchen route on both navs", () => {
    pathname.mockReturnValue("/people/abc");
    render(
      <>
        <KitchenNav />
        <KitchenNav variant="tabs" />
      </>
    );

    const people = screen.getAllByRole("link", { name: "People" });
    expect(people.every((link) => link.getAttribute("aria-current") === "page")).toBe(true);
    expect(
      screen
        .getAllByRole("link", { name: "Recipes" })
        .every((link) => !link.getAttribute("aria-current"))
    ).toBe(true);
  });
});
