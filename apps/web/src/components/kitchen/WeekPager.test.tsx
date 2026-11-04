import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WeekPager } from "./WeekPager";

describe("WeekPager", () => {
  it("keeps previous and next week as secondary ds-button links", () => {
    render(<WeekPager weekStart="2026-11-02" />);

    const nav = screen.getByRole("navigation", { name: "Week" });
    expect(nav).toHaveClass("week-pager");

    const previous = screen.getByRole("link", { name: "Previous week" });
    const next = screen.getByRole("link", { name: "Next week" });

    expect(previous.tagName).toBe("A");
    expect(next.tagName).toBe("A");
    expect(previous).toHaveAttribute("href", "/plans?week=2026-10-26");
    expect(next).toHaveAttribute("href", "/plans?week=2026-11-09");
    expect(nav).toContainElement(previous);
    expect(nav).toContainElement(next);

    for (const link of [previous, next]) {
      expect(link).toHaveClass(
        "ds-button",
        "ds-button--secondary",
        "ds-button--sm",
        "btn",
        "compact"
      );
      expect(link).not.toHaveAttribute("data-slot");
      expect(link).not.toHaveAttribute("type");
    }

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
