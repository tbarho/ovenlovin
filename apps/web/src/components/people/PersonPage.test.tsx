import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/browser-api";
import { testPerson, testPersonRule, testPreference } from "@/test/fixtures";
import { typeFullWordAndKeepFocus } from "@/test/sheet-focus";
import { PersonPage } from "./PersonPage";

const mockedApi = vi.mocked(api);

function addIn(bucket: string) {
  fireEvent.focus(within(screen.getByTestId(bucket)).getByPlaceholderText("Add…"));
}

describe("PersonPage", () => {
  beforeEach(() => {
    mockedApi.mockReset();
  });

  it("groups a tree-nut block under Can't eat and shows Loves", () => {
    render(
      <PersonPage
        person={testPerson({ displayName: "Child B" })}
        rules={[testPersonRule({ target: "tree_nut", severity: "block" })]}
        loves={[testPreference({ value: "salmon" })]}
      />
    );
    expect(screen.getByTestId("bucket-cant_eat")).toHaveTextContent(/tree nut/i);
    expect(screen.getByTestId("bucket-doesnt_like")).toHaveTextContent("None");
    expect(screen.getByTestId("bucket-loves")).toHaveTextContent(/salmon/i);
  });

  it("writes Can't eat tree nuts through the real rule mapping", async () => {
    mockedApi.mockResolvedValue(
      testPersonRule({
        id: "00000000-0000-4000-8000-000000000099",
        target: "tree_nut",
      })
    );
    render(<PersonPage person={testPerson({ displayName: "Child B" })} rules={[]} />);

    addIn("bucket-cant_eat");
    fireEvent.change(within(screen.getByTestId("bucket-cant_eat")).getByPlaceholderText("Add…"), {
      target: { value: "tree" },
    });
    fireEvent.click(screen.getByTestId("tile-tree_nut"));
    expect(screen.getByText(/avoid foods made where nuts are processed/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/treat coconut as a tree nut/i)).not.toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Done" }));

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

  it("offers Use ‘typed’ and saves a custom Doesn't like term", async () => {
    const user = userEvent.setup();
    mockedApi.mockResolvedValue(
      testPersonRule({
        id: "00000000-0000-4000-8000-000000000098",
        kind: "ingredient",
        target: "durian",
        severity: "prefer_avoid",
      })
    );
    render(<PersonPage person={testPerson({ displayName: "Child B" })} rules={[]} />);

    addIn("bucket-doesnt_like");
    await typeFullWordAndKeepFocus(
      user,
      within(screen.getByTestId("bucket-doesnt_like")).getByLabelText(/add to doesn't like/i),
      "durian"
    );
    fireEvent.click(screen.getByTestId("use-custom"));

    const [, init] = mockedApi.mock.calls[0] ?? [];
    expect(JSON.parse(String(init?.body))).toMatchObject({
      kind: "ingredient",
      target: "durian",
      severity: "prefer_avoid",
    });
  });

  it("saves a Loves pick", async () => {
    mockedApi.mockResolvedValue(testPreference({ value: "salmon" }));
    render(<PersonPage person={testPerson({ displayName: "Ty" })} rules={[]} loves={[]} />);

    addIn("bucket-loves");
    fireEvent.change(within(screen.getByTestId("bucket-loves")).getByPlaceholderText("Add…"), {
      target: { value: "salm" },
    });
    fireEvent.click(screen.getByTestId("tile-salmon"));

    expect(mockedApi).toHaveBeenCalledWith(
      "/api/v1/people/00000000-0000-4000-8000-000000000010/preferences",
      {
        method: "POST",
        body: JSON.stringify({ type: "love", value: "salmon" }),
      }
    );
  });

  it("removes a rule with undo that restores the same flags", async () => {
    const user = userEvent.setup();
    const rule = testPersonRule({ target: "peanut", sharedFacility: "block" });
    mockedApi.mockResolvedValue(undefined);
    render(<PersonPage person={testPerson({ displayName: "Child B" })} rules={[rule]} />);

    fireEvent.click(screen.getByRole("button", { name: "Remove Peanut" }));
    expect(mockedApi).toHaveBeenCalledWith(`/api/v1/people/${rule.personId}/rules/${rule.id}`, {
      method: "DELETE",
    });
    expect(await screen.findByRole("status")).toHaveTextContent(/removed peanut/i);

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

  it("adds from the inline typeahead without opening a sheet", async () => {
    const { container } = render(<PersonPage person={testPerson()} rules={[]} />);
    addIn("bucket-cant_eat");
    expect(document.querySelector(".olp-sheet-root")).toBeNull();
    expect(screen.queryByTestId("tile-tree_nut")).not.toBeInTheDocument();
    fireEvent.change(within(screen.getByTestId("bucket-cant_eat")).getByPlaceholderText("Add…"), {
      target: { value: "tree" },
    });
    expect(
      within(screen.getByTestId("bucket-cant_eat")).getByTestId("tile-tree_nut")
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /edit parent a/i }));
    const root = document.querySelector(".olp-sheet-root");
    expect(root).toBeTruthy();
    expect(root?.parentElement).toBe(document.body);
    expect(container.querySelector(".olp-sheet-root")).toBeNull();
  });

  it("keeps focus while typing in the inline add field", async () => {
    const user = userEvent.setup();
    render(<PersonPage person={testPerson()} rules={[]} />);
    const input = within(screen.getByTestId("bucket-cant_eat")).getByLabelText(/add to can't eat/i);
    await typeFullWordAndKeepFocus(user, input, "garlic");
    expect(
      within(screen.getByTestId("bucket-cant_eat")).getByTestId("tile-garlic")
    ).toBeInTheDocument();
  });

  it("adds the typed food on Enter instead of the first suggestion", async () => {
    const user = userEvent.setup();
    mockedApi.mockResolvedValue(
      testPersonRule({
        id: "00000000-0000-4000-8000-000000000096",
        kind: "ingredient",
        target: "pea",
        severity: "block",
      })
    );
    render(<PersonPage person={testPerson({ displayName: "Child B" })} rules={[]} />);
    const input = within(screen.getByTestId("bucket-cant_eat")).getByLabelText(/add to can't eat/i);
    await typeFullWordAndKeepFocus(user, input, "Pea");
    await user.keyboard("{Enter}");
    expect(mockedApi).not.toHaveBeenCalled();
    expect(screen.getByTestId("unknown-allergen-confirm")).toHaveTextContent(
      /can't check 'Pea' against recipes/i
    );
    await user.click(screen.getByTestId("save-unknown-allergy"));
    expect(JSON.parse(String(mockedApi.mock.calls[0]?.[1]?.body))).toMatchObject({
      kind: "ingredient",
      target: "pea",
      confirmUnknown: true,
    });
  });

  it("does not save an unknown Can't eat typo without confirmation", async () => {
    const user = userEvent.setup();
    mockedApi.mockResolvedValue(
      testPersonRule({
        id: "00000000-0000-4000-8000-000000000095",
        kind: "ingredient",
        target: "xyzzy",
        severity: "block",
      })
    );
    render(<PersonPage person={testPerson({ displayName: "Child B" })} rules={[]} />);
    const input = within(screen.getByTestId("bucket-cant_eat")).getByLabelText(/add to can't eat/i);
    await typeFullWordAndKeepFocus(user, input, "xyzzy");
    await user.keyboard("{Enter}");
    expect(mockedApi).not.toHaveBeenCalled();
    expect(screen.getByTestId("unknown-allergen-confirm")).toHaveTextContent(
      /can't check 'xyzzy' against recipes/i
    );
    await user.click(screen.getByTestId("save-unknown-allergy"));
    expect(JSON.parse(String(mockedApi.mock.calls[0]?.[1]?.body))).toMatchObject({
      kind: "ingredient",
      target: "xyzzy",
      confirmUnknown: true,
    });
  });

  it("adds the first typeahead match on Enter", async () => {
    const user = userEvent.setup();
    mockedApi.mockResolvedValue(
      testPersonRule({
        id: "00000000-0000-4000-8000-000000000097",
        kind: "ingredient",
        target: "garlic",
        severity: "prefer_avoid",
      })
    );
    render(<PersonPage person={testPerson()} rules={[]} />);
    const input = within(screen.getByTestId("bucket-doesnt_like")).getByLabelText(
      /add to doesn't like/i
    );
    await typeFullWordAndKeepFocus(user, input, "garlic");
    await user.keyboard("{Enter}");
    expect(mockedApi).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(mockedApi.mock.calls[0]?.[1]?.body))).toMatchObject({
      target: "garlic",
      severity: "prefer_avoid",
    });
  });

  it("switches people from the household row", () => {
    const current = testPerson({ displayName: "Ty" });
    const jake = testPerson({
      id: "00000000-0000-4000-8000-000000000018",
      displayName: "Jake",
    });
    render(<PersonPage person={current} people={[current, jake]} rules={[]} />);
    expect(screen.getByTestId(`switch-person-${jake.id}`)).toHaveAttribute(
      "href",
      `/people/${jake.id}`
    );
  });
});
