import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/browser-api";
import { writePersonNotes } from "@/lib/person-appearance";
import { testPerson, testPersonRule, testPreference } from "@/test/fixtures";
import { typeFullWordAndKeepFocus } from "@/test/sheet-focus";
import { PeopleHome } from "./PeopleHome";

const mockedApi = vi.mocked(api);

describe("PeopleHome", () => {
  beforeEach(() => {
    mockedApi.mockReset();
  });

  it("shows scannable cards with Can't eat, Doesn't like, and Loves chips", () => {
    const person = testPerson({ displayName: "Child B" });
    render(
      <PeopleHome
        householdName="Household 1"
        people={[person]}
        rules={[
          testPersonRule({ target: "tree_nut" }),
          testPersonRule({
            id: "00000000-0000-4000-8000-000000000016",
            target: "cilantro",
            kind: "ingredient",
            severity: "prefer_avoid",
          }),
        ]}
        loves={[testPreference({ value: "salmon" })]}
      />
    );
    expect(screen.getByRole("heading", { name: "Household 1" })).toBeInTheDocument();
    expect(screen.getByText("Child B")).toBeInTheDocument();
    expect(screen.getByTestId(`person-card-cant_eat-${person.id}`)).toHaveTextContent(/tree nut/i);
    expect(screen.getByTestId(`person-card-cant_eat-${person.id}`)).toHaveTextContent("1");
    expect(screen.getByTestId(`person-card-doesnt_like-${person.id}`)).toHaveTextContent(
      /cilantro/i
    );
    expect(screen.getByTestId(`person-card-loves-${person.id}`)).toHaveTextContent(/salmon/i);
    expect(screen.getByTestId("severe-badge")).toHaveTextContent(/1 severe allergy/);
  });

  it("keeps empty list-card lanes labeled None", () => {
    const person = testPerson({ displayName: "Parent A" });
    render(<PeopleHome householdName="Household 1" people={[person]} rules={[]} loves={[]} />);
    expect(screen.getByTestId(`person-card-cant_eat-${person.id}`)).toHaveTextContent("None");
    expect(screen.getByTestId(`person-card-doesnt_like-${person.id}`)).toHaveTextContent("None");
    expect(screen.getByTestId(`person-card-loves-${person.id}`)).toHaveTextContent("None");
    expect(screen.getByTestId(`person-card-cant_eat-${person.id}`)).toHaveTextContent("0");
  });

  it("clamps dense lanes to a two-line budget and leads Can't eat with allergens", () => {
    const person = testPerson({ displayName: "Parent A" });
    const cantEat = [
      testPersonRule({
        id: "00000000-0000-4000-8000-000000000021",
        target: "eggplant",
        kind: "ingredient",
      }),
      testPersonRule({
        id: "00000000-0000-4000-8000-000000000022",
        target: "sesame",
        kind: "allergen",
      }),
      testPersonRule({
        id: "00000000-0000-4000-8000-000000000023",
        target: "mustard",
        kind: "allergen",
      }),
      testPersonRule({
        id: "00000000-0000-4000-8000-000000000024",
        target: "celery",
        kind: "allergen",
      }),
      testPersonRule({
        id: "00000000-0000-4000-8000-000000000025",
        target: "lupin",
        kind: "allergen",
      }),
      testPersonRule({
        id: "00000000-0000-4000-8000-000000000026",
        target: "raisins",
        kind: "ingredient",
      }),
    ];
    const doesntLike = ["cilantro", "olives", "mushrooms", "onions", "garlic", "spicy"].map(
      (target, index) =>
        testPersonRule({
          id: `00000000-0000-4000-8000-00000000003${index}`,
          target,
          kind: "ingredient",
          severity: "prefer_avoid",
        })
    );
    const loves = ["salmon", "mexican", "spicy", "italian", "chicken", "pasta"].map(
      (value, index) =>
        testPreference({
          id: `00000000-0000-4000-8000-00000000004${index}`,
          value,
        })
    );
    render(
      <PeopleHome
        householdName="Household 1"
        people={[person]}
        rules={[...cantEat, ...doesntLike]}
        loves={loves}
      />
    );

    const cant = screen.getByTestId(`person-card-cant_eat-${person.id}`);
    expect(cant).toHaveTextContent("6");
    expect(cant).toHaveTextContent(/mustard/i);
    expect(cant).toHaveTextContent(/sesame/i);
    expect(cant).not.toHaveTextContent(/eggplant/i);
    expect(screen.getByTestId(`person-card-more-cant_eat-${person.id}`)).toHaveTextContent(
      "+2 more"
    );
    expect(screen.getByTestId(`person-card-more-doesnt_like-${person.id}`)).toHaveTextContent(
      "+2 more"
    );
    expect(screen.getByTestId(`person-card-more-loves-${person.id}`)).toHaveTextContent("+2 more");
    expect(cant).not.toHaveTextContent(/raisins/i);
  });

  it("exposes only an in-card drag handle for reorder", () => {
    const ty = testPerson({
      id: "00000000-0000-4000-8000-000000000010",
      displayName: "Ty",
      sortOrder: 0,
    });
    const jake = testPerson({
      id: "00000000-0000-4000-8000-000000000011",
      displayName: "Jake",
      sortOrder: 1,
    });
    render(<PeopleHome householdName="Household 1" people={[ty, jake]} rules={[]} loves={[]} />);

    expect(screen.queryByRole("button", { name: "Move Ty down" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Move Ty up" })).not.toBeInTheDocument();
    const handle = screen.getByRole("button", { name: "Reorder Ty" });
    expect(handle).toHaveStyle({ minWidth: "44px", minHeight: "44px", cursor: "grab" });
    expect(handle.closest(`[data-testid="person-card-shell-${ty.id}"]`)).toBeTruthy();
  });

  it("adds a person with a chosen emoji", async () => {
    const user = userEvent.setup();
    mockedApi.mockResolvedValue(testPerson({ displayName: "Child B" }));
    render(<PeopleHome householdName="Household 1" people={[]} rules={[]} />);

    await typeFullWordAndKeepFocus(user, screen.getByPlaceholderText("Name"), "Child B");
    await user.click(screen.getByRole("button", { name: "Use ⚽️" }));
    await user.click(screen.getByRole("button", { name: "Add person" }));

    expect(mockedApi).toHaveBeenCalledWith("/api/v1/people", {
      method: "POST",
      body: JSON.stringify({
        displayName: "Child B",
        notes: writePersonNotes({ emoji: "⚽️", color: "#e07a3d" }),
      }),
    });
  });
});
