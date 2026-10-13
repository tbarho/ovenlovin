import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/browser-api";
import { writePersonNotes } from "@/lib/person-appearance";
import { testPerson, testPersonRule } from "@/test/fixtures";
import { typeFullWordAndKeepFocus } from "@/test/sheet-focus";
import { PeopleHome } from "./PeopleHome";

const mockedApi = vi.mocked(api);

describe("PeopleHome", () => {
  beforeEach(() => {
    mockedApi.mockReset();
  });

  it("shows scannable cards with severity chips", () => {
    render(
      <PeopleHome
        householdName="Household 1"
        people={[testPerson({ displayName: "Child B" })]}
        rules={[testPersonRule({ target: "tree_nut" })]}
      />
    );
    expect(screen.getByRole("heading", { name: "Household 1" })).toBeInTheDocument();
    expect(screen.getByText("Child B")).toBeInTheDocument();
    expect(screen.getByText(/tree nuts/i)).toBeInTheDocument();
    expect(screen.getByTestId("severe-badge")).toHaveTextContent(/1 severe allergy/);
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
