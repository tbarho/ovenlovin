import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { testPerson, testPersonRule } from "@/test/fixtures";
import { WhoCanEat } from "./WhoCanEat";

describe("WhoCanEat", () => {
  const child = testPerson({
    id: "00000000-0000-4000-8000-000000000012",
    displayName: "Child B",
  });
  const parent = testPerson({ displayName: "Parent A" });
  const treeNut = testPersonRule({
    personId: child.id,
    target: "tree_nut",
    severity: "block",
    includeCrossContact: true,
    includeMayContain: true,
    sharedFacility: "warn",
    treatCoconutAsTreeNut: false,
  });

  it("marks Child B blocked on pesto and shows the reason on tap", async () => {
    const user = userEvent.setup();
    render(
      <WhoCanEat
        people={[parent, child]}
        rules={[treeNut]}
        ingredients={[
          { id: "pesto", name: "1/3 cup pesto" },
          { id: "basil", name: "basil" },
        ]}
      />
    );

    expect(screen.queryByText(/not medical advice/i)).not.toBeInTheDocument();
    expect(screen.getByTestId(`mark-${child.id}`)).toHaveAttribute("data-mark", "block");
    expect(screen.getByTestId(`mark-${parent.id}`)).toHaveAttribute("data-mark", "ok");
    expect(screen.getByText("Can't eat")).toBeVisible();
    expect(screen.getByText("OK")).toBeVisible();
    expect(screen.getByTestId("who-can-eat")).toHaveClass("olp-who-row");
    expect(
      screen.getByRole("button", { name: /Child B: Can't eat. Opens details/i })
    ).toBeVisible();

    await user.click(screen.getByTestId(`mark-${child.id}`));
    expect(screen.getByRole("dialog", { name: /can't eat this/i })).toBeVisible();
    expect(screen.getByText(/Contains pine nuts.*Child B can't eat this/)).toBeInTheDocument();
    expect(screen.getByText(/no stored swap/i)).toBeInTheDocument();
  });

  it("applies a stored substitution note from the reason sheet", async () => {
    const user = userEvent.setup();
    render(
      <WhoCanEat
        people={[child]}
        rules={[treeNut]}
        ingredients={[
          {
            id: "pesto",
            name: "pesto",
            substitutionNotes: "sunflower seed pesto",
          },
        ]}
      />
    );

    expect(screen.getByTestId(`mark-${child.id}`)).toHaveAttribute("data-mark", "block");
    await user.click(screen.getByTestId(`mark-${child.id}`));
    await user.click(screen.getByRole("button", { name: /try this swap/i }));
    expect(screen.getByTestId(`mark-${child.id}`)).toHaveAttribute("data-mark", "ok");
  });

  it("does not show loves or all-clear chips when a recipe has no ingredients", () => {
    render(<WhoCanEat people={[parent, child]} rules={[treeNut]} ingredients={[]} />);

    expect(screen.getByTestId("who-incomplete")).toHaveTextContent(/no ingredients/i);
    expect(screen.queryByText("OK")).not.toBeInTheDocument();
    expect(screen.queryByText("Can't eat")).not.toBeInTheDocument();
    expect(screen.queryByText(/loves this/i)).not.toBeInTheDocument();
  });
});
