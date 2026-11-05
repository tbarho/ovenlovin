import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Badge } from "./badge";

describe("Badge", () => {
  it("renders text so color is not the only signal", () => {
    render(<Badge variant="ok">Safe</Badge>);
    const badge = screen.getByText("Safe").closest("[data-slot='badge']");
    expect(badge).toHaveAttribute("data-variant", "ok");
    expect(badge).toHaveClass("ds-badge", "ds-badge--ok", "ds-badge--pill");
  });

  it("shows an optional icon beside the label", () => {
    render(
      <Badge variant="warn" icon={<span data-testid="warn-icon">!</span>}>
        Check
      </Badge>
    );
    expect(screen.getByTestId("warn-icon")).toBeVisible();
    expect(screen.getByText("Check")).toBeVisible();
  });

  it("supports a rounded shape", () => {
    render(
      <Badge variant="bad" shape="rounded">
        Block
      </Badge>
    );
    expect(screen.getByText("Block").closest("[data-slot='badge']")).toHaveAttribute(
      "data-shape",
      "rounded"
    );
  });
});
