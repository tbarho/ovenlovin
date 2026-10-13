import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/browser-api";
import { testPerson, testPersonRule } from "@/test/fixtures";
import { typeFullWordAndKeepFocus } from "@/test/sheet-focus";
import { PersonPage } from "./PersonPage";

const mockedApi = vi.mocked(api);

describe("PersonPage", () => {
  beforeEach(() => {
    mockedApi.mockReset();
  });

  it("groups a tree-nut block under Can't have", () => {
    render(
      <PersonPage
        person={testPerson({ displayName: "Child B" })}
        rules={[testPersonRule({ target: "tree_nut", severity: "block" })]}
      />
    );
    expect(screen.getByTestId("bucket-cant_have")).toHaveTextContent(/tree nut/i);
    expect(screen.getByTestId("bucket-doesnt_eat")).toHaveTextContent("None");
  });

  it("writes Can't have tree nuts through the real rule mapping", async () => {
    const user = userEvent.setup();
    mockedApi.mockResolvedValue(
      testPersonRule({
        id: "00000000-0000-4000-8000-000000000099",
        target: "tree_nut",
      })
    );
    render(<PersonPage person={testPerson({ displayName: "Child B" })} rules={[]} />);

    await user.click(screen.getByRole("button", { name: "Add" }));
    await user.click(screen.getByTestId("tile-tree_nut"));
    expect(screen.getByRole("tab", { name: "Can't have" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.getByText(/avoid foods made where nuts are processed/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/treat coconut as a tree nut/i)).not.toBeChecked();
    await user.click(screen.getByRole("button", { name: "Done" }));

    expect(mockedApi).toHaveBeenCalledTimes(1);
    const [, init] = mockedApi.mock.calls[0] ?? [];
    expect(init?.method).toBe("POST");
    const body = JSON.parse(String(init?.body)) as {
      kind: string;
      target: string;
      severity: string;
      sharedFacility: string;
      includeCrossContact: boolean;
      treatCoconutAsTreeNut: boolean;
    };
    expect(body).toMatchObject({
      kind: "allergen",
      target: "tree_nut",
      severity: "block",
      sharedFacility: "warn",
      includeCrossContact: true,
      treatCoconutAsTreeNut: false,
    });
  });

  it("removes a rule with undo that restores the same flags", async () => {
    const user = userEvent.setup();
    const rule = testPersonRule({ target: "peanut", sharedFacility: "block" });
    mockedApi.mockResolvedValue(undefined);
    render(<PersonPage person={testPerson({ displayName: "Child B" })} rules={[rule]} />);

    await user.click(screen.getByRole("button", { name: "Remove Peanut" }));
    expect(mockedApi).toHaveBeenCalledWith(`/api/v1/people/${rule.personId}/rules/${rule.id}`, {
      method: "DELETE",
    });
    expect(screen.getByRole("status")).toHaveTextContent(/removed peanut/i);

    mockedApi.mockResolvedValue(rule);
    await user.click(screen.getByRole("button", { name: "Undo" }));
    const undoCall = mockedApi.mock.calls.at(-1);
    expect(undoCall?.[1]?.method).toBe("POST");
    expect(JSON.parse(String(undoCall?.[1]?.body))).toMatchObject({
      kind: "allergen",
      target: "peanut",
      severity: "block",
      sharedFacility: "block",
    });
  });

  it("portals the add-rule sheet onto document.body so it covers the kitchen header", async () => {
    const user = userEvent.setup();
    const { container } = render(<PersonPage person={testPerson()} rules={[]} />);
    await user.click(screen.getByRole("button", { name: "Add" }));
    const root = document.querySelector(".olp-sheet-root");
    expect(root).toBeTruthy();
    expect(root?.parentElement).toBe(document.body);
    expect(container.querySelector(".olp-sheet-root")).toBeNull();
  });

  it("keeps focus while typing in the add-rule search", async () => {
    const user = userEvent.setup();
    render(<PersonPage person={testPerson()} rules={[]} />);
    await user.click(screen.getByRole("button", { name: "Add" }));
    await typeFullWordAndKeepFocus(user, screen.getByLabelText(/search foods/i), "garlic");
    expect(within(screen.getByRole("dialog")).getByTestId("tile-garlic")).toBeInTheDocument();
  });
});
