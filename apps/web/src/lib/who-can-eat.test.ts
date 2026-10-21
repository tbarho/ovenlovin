import { ShoppingListService } from "@ovenlovin/core";
import { describe, expect, it } from "vitest";
import { testPerson, testPersonRule } from "@/test/fixtures";
import { whoCanEat } from "./who-can-eat";

describe("whoCanEat", () => {
  const child = testPerson({
    id: "00000000-0000-4000-8000-000000000012",
    displayName: "Child B",
  });
  const parent = testPerson({ displayName: "Parent A" });
  const treeNut = testPersonRule({
    personId: child.id,
    target: "tree_nut",
    severity: "block",
    sharedFacility: "warn",
    includeCrossContact: true,
    includeMayContain: true,
    treatCoconutAsTreeNut: false,
  });

  it("preserves the household people order", () => {
    const result = whoCanEat({
      people: [parent, child],
      rules: [treeNut],
      ingredients: [{ id: "pesto", name: "1/3 cup pesto" }],
    });
    expect(result.people.map((item) => item.personId)).toEqual([parent.id, child.id]);
  });

  it("blocks Child B on pesto pine nuts via the real checker", () => {
    const result = whoCanEat({
      people: [parent, child],
      rules: [treeNut],
      ingredients: [
        { id: "pesto", name: "1/3 cup pesto" },
        { id: "basil", name: "2 cups fresh basil" },
      ],
    });
    expect(result.status).toBe("complete");
    expect(result.people.find((item) => item.personId === child.id)?.mark).toBe("block");
    const reasons =
      result.people.find((item) => item.personId === child.id)?.reasons.join(" ") ?? "";
    expect(reasons).toMatch(/pine nuts/i);
    expect(reasons).toMatch(/Child B can't eat this/);
    expect(reasons).not.toMatch(/block\s*:/);
    expect(reasons).not.toMatch(/tree_nut/);
    expect(result.people.find((item) => item.personId === parent.id)?.mark).toBe("ok");
  });

  it("applies a stored substitution note as a one-tap swap", () => {
    const blocked = whoCanEat({
      people: [child],
      rules: [treeNut],
      ingredients: [
        {
          id: "pesto",
          name: "pesto",
          substitutionNotes: "sunflower seed pesto",
        },
      ],
    });
    const swapped = whoCanEat({
      people: [child],
      rules: [treeNut],
      ingredients: [
        {
          id: "pesto",
          name: "pesto",
          substitutionNotes: "sunflower seed pesto",
        },
      ],
      appliedSwapIds: ["pesto"],
    });
    expect(blocked.people[0]?.mark).toBe("block");
    expect(swapped.people[0]?.mark).toBe("ok");
  });

  it("treats a milk dislike as ask first, not a hard block", () => {
    const milk = testPersonRule({
      personId: parent.id,
      target: "milk",
      severity: "prefer_avoid",
    });
    const result = whoCanEat({
      people: [parent],
      rules: [milk],
      ingredients: [{ id: "mozz", name: "mozzarella" }],
    });
    expect(result.people[0]?.mark).toBe("warn");
    expect(result.people[0]?.title).toMatch(/check with Parent A first/i);
    expect(result.people[0]?.mark).not.toBe("block");
  });

  it("lists one dairy reason when mozzarella and parmesan both match", () => {
    const milk = testPersonRule({
      personId: parent.id,
      target: "milk",
      severity: "warn",
    });
    const result = whoCanEat({
      people: [parent],
      rules: [milk],
      ingredients: [
        { id: "mozz", name: "mozzarella" },
        { id: "parm", name: "parmesan" },
        { id: "parm2", name: "Parmesan cheese" },
        { id: "butter", name: "unsalted butter" },
      ],
    });
    const reasons = result.people[0]?.reasons ?? [];
    const dairy = reasons.filter((reason) => /dairy/i.test(reason));
    expect(dairy).toHaveLength(1);
    expect(dairy[0]).toMatch(/mozzarella/i);
    expect(dairy[0]).toMatch(/parmesan/i);
    expect(dairy[0]).toMatch(/butter/i);
  });

  it("still sees peanut and sesame in parenthetical and comma lists", () => {
    const peanut = testPersonRule({
      personId: child.id,
      target: "peanut",
      severity: "block",
    });
    const sesame = testPersonRule({
      personId: child.id,
      target: "sesame",
      severity: "block",
    });
    const result = whoCanEat({
      people: [child],
      rules: [peanut, sesame],
      ingredients: [
        { id: "oil", name: "oil (peanut or canola)" },
        { id: "seasoning", name: "salt, pepper, and sesame seeds" },
        { id: "topping", name: "Optional: chopped peanuts, cilantro, lime" },
      ],
    });
    expect(result.status).toBe("complete");
    const reasons = result.people[0]?.reasons.join(" ") ?? "";
    expect(reasons).toMatch(/peanut/i);
    expect(reasons).toMatch(/sesame/i);
    expect(result.people[0]?.mark).toBe("block");
  });

  it("does not report a clean bill when the check is incomplete", () => {
    const result = whoCanEat({
      people: [child],
      rules: [treeNut],
      ingredients: [],
    });
    expect(result.status).toBe("incomplete");
    expect(result.people[0]?.mark).not.toBe("ok");
    expect(result.people[0]?.title).toMatch(/could not finish/i);
  });

  it("still warns on a built list that includes almond flour and peanut butter", () => {
    const peanutKid = testPerson({
      id: "00000000-0000-4000-8000-000000000013",
      displayName: "Child C",
    });
    const peanut = testPersonRule({
      personId: peanutKid.id,
      target: "peanut",
      severity: "block",
    });
    const list = new ShoppingListService().build({
      mealPlanId: "plan-1",
      weekStart: "2026-10-12",
      generatedAt: "2026-10-14T00:00:00.000Z",
      entries: [
        {
          entry: {
            id: "entry-1",
            createdAt: "2026-10-12T00:00:00.000Z",
            updatedAt: "2026-10-12T00:00:00.000Z",
            deletedAt: null,
            mealPlanId: "plan-1",
            date: "2026-10-12",
            mealSlot: "dinner",
            recipeId: "cookies",
            freeformMeal: null,
            servings: 4,
            attendees: [],
            scaleFactor: 1,
            prepAheadNotes: null,
            leftoverSourceId: null,
          },
          recipeTitle: "Cookies",
          recipeServings: 4,
          ingredients: [{ rawText: "1 cup almond flour" }, { rawText: "1/2 cup peanut butter" }],
        },
      ],
    });
    const names = list.ingredients.map((item) => item.name);
    expect(names).toContain("almond flour");
    expect(names).toContain("peanut butter");
    expect(names).not.toContain("all purpose flour");

    const warnings = list.ingredients.flatMap((item) => {
      const check = whoCanEat({
        people: [child, peanutKid],
        rules: [treeNut, peanut],
        ingredients: [{ id: item.key || `shop-${item.name}`, name: item.name }],
      });
      return check.people.flatMap((person) => person.reasons);
    });
    expect(warnings.join(" ")).toMatch(/almond|tree nut/i);
    expect(warnings.join(" ")).toMatch(/peanut/i);
    expect(warnings.join(" ")).toMatch(/Child B can't eat this/);
    expect(warnings.join(" ")).toMatch(/Child C can't eat this/);
  });
});
