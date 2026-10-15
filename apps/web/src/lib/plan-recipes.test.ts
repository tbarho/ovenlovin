import { describe, expect, it } from "vitest";
import { filterPlanRecipes, saferPicks } from "./plan-recipes";
import type { PlanRecipePick } from "./week-plan";

function pick(
  overrides: Partial<PlanRecipePick> & Pick<PlanRecipePick, "id" | "title">
): PlanRecipePick {
  return {
    image: null,
    servings: 4,
    cookTimeMinutes: 20,
    prepTimeMinutes: 10,
    safety: "ok",
    warning: null,
    ...overrides,
  };
}

describe("filterPlanRecipes", () => {
  const pesto = pick({
    id: "pesto",
    title: "Weeknight pesto pasta",
    safety: "block",
    warning: "Contains pine nuts, so Child B can't eat this",
  });
  const tacos = pick({ id: "tacos", title: "Veggie tacos", safety: "ok" });
  const chili = pick({ id: "chili", title: "Beef chili", safety: "warn" });

  it("keeps blocked recipes visible and ranks safer ones first", () => {
    const listed = filterPlanRecipes([pesto, chili, tacos], "");
    expect(listed.map((recipe) => recipe.id)).toEqual(["tacos", "chili", "pesto"]);
    expect(listed.some((recipe) => recipe.safety === "block")).toBe(true);
  });

  it("filters by title without hiding a matching block", () => {
    const listed = filterPlanRecipes([pesto, tacos], "pesto");
    expect(listed).toEqual([pesto]);
  });
});

describe("saferPicks", () => {
  it("suggests ok recipes when the current dinner is a block", () => {
    const pesto = pick({
      id: "pesto",
      title: "Weeknight pesto pasta",
      safety: "block",
      warning: "Contains pine nuts, so Child B can't eat this",
    });
    const tacos = pick({ id: "tacos", title: "Veggie tacos", safety: "ok" });
    const swaps = saferPicks([pesto, tacos], "pesto", [
      { personName: "Child B", severity: "block", message: pesto.warning ?? "" },
    ]);
    expect(swaps.map((recipe) => recipe.id)).toEqual(["tacos"]);
  });

  it("does not invent swaps when nothing is blocked", () => {
    const tacos = pick({ id: "tacos", title: "Veggie tacos", safety: "ok" });
    expect(saferPicks([tacos], "tacos", [])).toEqual([]);
  });
});
