import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LoveTags } from "./LoveTags";

const childCLove = {
  personId: "child-c",
  personName: "Child C",
  value: "pasta",
  label: "Pasta",
  tag: "Child C loves this",
};

describe("LoveTags", () => {
  it("hides a love tag when that person has a safety finding", () => {
    render(
      <LoveTags
        hits={[
          {
            personId: "parent-b",
            personName: "Parent B",
            value: "pasta",
            label: "Pasta",
            tag: "Parent B loves this",
          },
        ]}
        warningPersonIds={["parent-b"]}
      />
    );
    expect(screen.queryByTestId("love-tags")).not.toBeInTheDocument();
    expect(screen.queryByText(/loves this/)).not.toBeInTheDocument();
  });

  it("hides a love tag when that person can't eat the recipe", () => {
    render(<LoveTags hits={[childCLove]} blockPersonIds={["child-c"]} />);
    expect(screen.queryByTestId("love-tags")).not.toBeInTheDocument();
    expect(screen.queryByText(/loves this/)).not.toBeInTheDocument();
  });

  it("leads with a red block chip before any love when someone can't eat this", () => {
    render(
      <LoveTags
        hits={[
          {
            personId: "parent-b",
            personName: "Parent B",
            value: "pasta",
            label: "Pasta",
            tag: "Parent B loves this",
          },
        ]}
        blockTitles={["Child C can't eat this"]}
      />
    );
    const row = screen.getByTestId("love-tags");
    expect(row.firstChild).toHaveTextContent("Child C can't eat this");
    expect(row.firstChild).toHaveClass("who-chip-block");
    expect(screen.getByText("Parent B loves this")).toBeVisible();
  });
});
