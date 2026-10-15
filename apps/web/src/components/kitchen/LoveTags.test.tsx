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
  it("qualifies a love tag when that person also has a warning", () => {
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
    expect(screen.getByText("Parent B loves this — check first")).toBeVisible();
    expect(screen.queryByText("Parent B loves this")).not.toBeInTheDocument();
  });

  it("hides a love tag when that person can't eat the recipe", () => {
    render(<LoveTags hits={[childCLove]} blockPersonIds={["child-c"]} />);
    expect(screen.queryByTestId("love-tags")).not.toBeInTheDocument();
    expect(screen.queryByText(/loves this/)).not.toBeInTheDocument();
  });
});
