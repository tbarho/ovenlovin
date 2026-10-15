import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LoveTags } from "./LoveTags";

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
});
