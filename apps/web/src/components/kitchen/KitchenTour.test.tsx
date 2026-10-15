import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RecipesKitchen } from "./RecipesKitchen";

describe("KitchenTour", () => {
  it("shows the start card on first paint so it is visible at phone width", () => {
    render(<RecipesKitchen cookbooks={[]} uncategorized={[]} recipes={[]} />);
    expect(screen.getByRole("region", { name: "Getting started" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Start your kitchen" })).toBeVisible();
  });
});
