import { describe, expect, it } from "vitest";
import {
  CATALOG,
  DEMO_HOUSEHOLD,
  RECIPES,
  applySwaps,
  checkPerson,
  checkRecipe,
  defaultBucketForItem,
  formatList,
  searchCatalog,
  summarizeHousehold,
} from "./model";

function person(id: string) {
  const found = DEMO_HOUSEHOLD.people.find((item) => item.id === id);
  if (!found) throw new Error(`missing ${id}`);
  return found;
}

function recipe(id: string) {
  const found = RECIPES.find((item) => item.id === id);
  if (!found) throw new Error(`missing ${id}`);
  return found;
}

describe("summarizeHousehold", () => {
  it("matches the demo copy: peanuts, tree nuts, dairy, one severe allergy", () => {
    const summary = summarizeHousehold(DEMO_HOUSEHOLD);
    expect(summary.line).toBe("Avoids peanuts, tree nuts, and dairy");
    expect(summary.severeCount).toBe(1);
    expect(summary.badge).toBe("1 severe allergy");
  });

  it("teaches when the household is empty", () => {
    const summary = summarizeHousehold({ name: "Your kitchen", people: [] });
    expect(summary.line).toBe("Add the people you cook for.");
    expect(summary.badge).toBeNull();
  });
});

describe("formatList", () => {
  it("joins two and three items in plain language", () => {
    expect(formatList(["peanuts"])).toBe("peanuts");
    expect(formatList(["peanuts", "dairy"])).toBe("peanuts and dairy");
    expect(formatList(["peanuts", "tree nuts", "dairy"])).toBe("peanuts, tree nuts, and dairy");
  });
});

describe("checkRecipe", () => {
  it("blocks Jake on pesto because pine nuts count as a tree nut", () => {
    const finding = checkPerson(person("jake"), recipe("pesto-pasta"));
    expect(finding.mark).toBe("block");
    expect(finding.reason).toBe("Contains pine nuts, which counts as a tree nut for Jake.");
  });

  it("blocks Bec on pesto because Parmesan is dairy", () => {
    const finding = checkPerson(person("bec"), recipe("pesto-pasta"));
    expect(finding.mark).toBe("block");
    expect(finding.reason).toMatch(/parmesan/i);
    expect(finding.reason).toMatch(/Bec/);
  });

  it("clears Jake's block when pine nuts are swapped, and keeps a facility warning", () => {
    const swapped = applySwaps(recipe("pesto-pasta"), ["sunflower"]);
    const finding = checkPerson(person("jake"), swapped);
    expect(finding.mark).toBe("warn");
    expect(finding.reason).toMatch(/processed/i);
    expect(swapped.ingredients.some((item) => item.tags.includes("tree_nut"))).toBe(false);
  });

  it("marks Ty and Laynie as ok on pesto", () => {
    expect(checkPerson(person("ty"), recipe("pesto-pasta")).mark).toBe("ok");
    expect(checkPerson(person("laynie"), recipe("pesto-pasta")).mark).toBe("ok");
  });

  it("warns Ellie only when mushrooms are present", () => {
    expect(checkPerson(person("ellie"), recipe("mushroom-risotto")).mark).toBe("warn");
    expect(checkPerson(person("ellie"), recipe("pesto-pasta")).mark).toBe("ok");
  });

  it("filters cooking-for kids so Bec's dairy does not appear", () => {
    const findings = checkRecipe(DEMO_HOUSEHOLD, recipe("pesto-pasta"), [], { mode: "kids" });
    expect(findings.map((item) => item.personId).sort()).toEqual(["ellie", "jake", "laynie"]);
    expect(findings.some((item) => item.personId === "bec")).toBe(false);
  });
});

describe("searchCatalog", () => {
  it("finds pine nuts and coconut from free text", () => {
    expect(searchCatalog("pine").some((item) => item.id === "pine_nut")).toBe(true);
    expect(searchCatalog("coco").some((item) => item.id === "coconut")).toBe(true);
  });
});

describe("defaultBucketForItem", () => {
  it("defaults allergens to can't have and diets to doesn't eat", () => {
    const peanut = CATALOG.find((item) => item.id === "peanut");
    const vegetarian = CATALOG.find((item) => item.id === "vegetarian");
    const mushroom = CATALOG.find((item) => item.id === "mushroom");
    expect(peanut && defaultBucketForItem(peanut)).toBe("cant_have");
    expect(vegetarian && defaultBucketForItem(vegetarian)).toBe("doesnt_eat");
    expect(mushroom && defaultBucketForItem(mushroom)).toBe("rather_not");
  });
});
