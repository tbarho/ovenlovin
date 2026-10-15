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
      ],
    });
    const reasons = result.people[0]?.reasons ?? [];
    const dairy = reasons.filter((reason) => /dairy/i.test(reason));
    expect(dairy).toHaveLength(1);
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
});
