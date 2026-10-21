import { describe, expect, it } from "vitest";
import {
  applyDinnerToDays,
  filterPlanRecipes,
  partitionPlanRecipes,
  planRiskConfirmCopy,
  recipeNeedsPlanConfirm,
  saferPicks,
} from "./plan-recipes";
import { groupMealsByDate } from "./week-plan-view";
import type { PlanRecipePick } from "./week-plan-view";

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

describe("partitionPlanRecipes", () => {
  const pesto = pick({
    id: "pesto",
    title: "Weeknight pesto pasta",
    safety: "block",
    warning: "Contains pine nuts, so Child B can't eat this",
  });
  const tacos = pick({ id: "tacos", title: "Veggie tacos", safety: "ok" });
  const chili = pick({ id: "chili", title: "Beef chili", safety: "warn" });

  it("keeps ask-first and dislike recipes visible and only collapses blocks", () => {
    const groups = partitionPlanRecipes([pesto, chili, tacos], "", null);
    expect(groups.safer.map((recipe) => recipe.id)).toEqual(["tacos"]);
    expect(groups.safe.map((recipe) => recipe.id)).toEqual(["chili"]);
    expect(groups.unsafe.map((recipe) => recipe.id)).toEqual(["pesto"]);
  });

  it("does not hide recipes when the only findings are ask-first", () => {
    const groups = partitionPlanRecipes([chili, tacos], "", null);
    expect(groups.safer).toEqual([]);
    expect(groups.safe.map((recipe) => recipe.id)).toEqual(["tacos", "chili"]);
    expect(groups.unsafe).toEqual([]);
  });

  it("keeps the current blocked dinner visible instead of collapsing it", () => {
    const groups = partitionPlanRecipes([pesto, tacos], "", "pesto");
    expect(groups.safer.map((recipe) => recipe.id)).toEqual(["tacos"]);
    expect(groups.safe.map((recipe) => recipe.id)).toEqual(["pesto"]);
    expect(groups.unsafe).toEqual([]);
  });
});

describe("plan risk confirm copy", () => {
  it("names the person and allergen before adding a blocked recipe", () => {
    const kungPao = pick({
      id: "kung-pao",
      title: "Kung pao chicken",
      safety: "block",
      warning: "Contains peanuts, so Child B can't eat this. Anaphylaxis risk",
    });
    expect(recipeNeedsPlanConfirm(kungPao)).toBe(true);
    expect(
      recipeNeedsPlanConfirm(pick({ id: "scan", title: "Photo import", safety: "unknown" }))
    ).toBe(true);
    expect(recipeNeedsPlanConfirm(pick({ id: "tacos", title: "Veggie tacos" }))).toBe(false);
    expect(
      recipeNeedsPlanConfirm(pick({ id: "pizza", title: "Weeknight pizza", safety: "ok" }))
    ).toBe(false);
    const copy = planRiskConfirmCopy(kungPao, "Sunday");
    expect(copy.title).toContain("Kung pao chicken");
    expect(copy.title).toContain("Sunday");
    expect(copy.body).toContain("Child B");
    expect(copy.body).toContain("peanuts");
    expect(copy.body).toContain("warning stays on Sunday");
    const unknownCopy = planRiskConfirmCopy(
      pick({ id: "scan", title: "Photo import", safety: "unknown" }),
      "Monday"
    );
    expect(unknownCopy.body).toContain("We couldn't check this recipe's ingredients.");
    expect(unknownCopy.body).not.toMatch(/[\u2013\u2014]/);
  });
});

describe("applyDinnerToDays", () => {
  it("swaps Monday dinner immediately so the cook sees the new title", () => {
    const days = groupMealsByDate("2026-10-12", [
      {
        entryId: "entry-1",
        date: "2026-10-12",
        mealSlot: "dinner",
        recipeId: "pesto",
        title: "Weeknight pesto pasta",
        href: "/recipes/pesto",
        image: null,
        servings: 4,
        isNoCook: false,
        findings: [],
        checkStatus: "complete",
      },
    ]);
    const next = applyDinnerToDays(days, "2026-10-12", { recipeId: "tacos", freeformMeal: null }, [
      pick({ id: "tacos", title: "Veggie tacos" }),
    ]);
    expect(next[0]?.meals[0]?.title).toBe("Veggie tacos");
    expect(next[0]?.meals[0]?.findings).toEqual([]);
  });

  it("rechecks only the swapped night from that recipe's safety", () => {
    const days = groupMealsByDate("2026-10-12", [
      {
        entryId: "entry-1",
        date: "2026-10-12",
        mealSlot: "dinner",
        recipeId: "pesto",
        title: "Weeknight pesto pasta",
        href: "/recipes/pesto",
        image: null,
        servings: 4,
        isNoCook: false,
        findings: [
          {
            personName: "Child B",
            severity: "block",
            message: "Contains pine nuts, so Child B can't eat this",
          },
        ],
        checkStatus: "complete",
      },
      {
        entryId: "entry-2",
        date: "2026-10-13",
        mealSlot: "dinner",
        recipeId: "tacos",
        title: "Veggie tacos",
        href: "/recipes/tacos",
        image: null,
        servings: 4,
        isNoCook: false,
        findings: [],
        checkStatus: "complete",
      },
    ]);
    const next = applyDinnerToDays(
      days,
      "2026-10-12",
      { recipeId: "kung-pao", freeformMeal: null },
      [
        pick({
          id: "kung-pao",
          title: "Kung pao chicken",
          safety: "block",
          warning: "Contains peanuts, so Child B can't eat this. Anaphylaxis risk",
        }),
      ]
    );
    expect(next[0]?.meals[0]?.title).toBe("Kung pao chicken");
    expect(next[0]?.meals[0]?.findings[0]?.message).toMatch(/peanuts/);
    expect(next[1]?.meals[0]?.title).toBe("Veggie tacos");
    expect(next[1]?.meals[0]?.findings).toEqual([]);
  });
});
