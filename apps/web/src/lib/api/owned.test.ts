import { describe, expect, it } from "vitest";
import { NotFoundError } from "./errors";
import { loadOwned, loadOwnedChild } from "./owned";

const ID = "550e8400-e29b-41d4-a716-446655440000";
const KITCHEN_A = "11111111-1111-4111-8111-111111111111";
const KITCHEN_B = "22222222-2222-4222-8222-222222222222";

describe("loadOwned", () => {
  it("404s a malformed id before loading", async () => {
    let loaded = false;
    await expect(
      loadOwned("MealPlan", "x", KITCHEN_B, async () => {
        loaded = true;
        return { householdId: KITCHEN_B };
      })
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(loaded).toBe(false);
  });

  it("404s a row from another kitchen", async () => {
    await expect(
      loadOwned("MealPlan", ID, KITCHEN_B, async () => ({ householdId: KITCHEN_A }))
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("returns a row in this kitchen", async () => {
    const row = { householdId: KITCHEN_B, title: "Pesto" };
    await expect(loadOwned("MealPlan", ID, KITCHEN_B, async () => row)).resolves.toBe(row);
  });
});

describe("loadOwnedChild", () => {
  it("404s a malformed nested id", async () => {
    await expect(
      loadOwnedChild(
        "Rule",
        "x",
        async () => ({ personId: ID }),
        (row) => row.personId === ID
      )
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("404s a child that belongs to another parent", async () => {
    await expect(
      loadOwnedChild(
        "Rule",
        ID,
        async () => ({ personId: KITCHEN_A }),
        (row) => row.personId === KITCHEN_B
      )
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
