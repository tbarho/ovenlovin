import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AllergenDisclaimer } from "./AllergenDisclaimer";

describe("AllergenDisclaimer", () => {
  it("keeps one calm line and skips the medical-advice pile-on", () => {
    render(<AllergenDisclaimer />);
    expect(screen.getByRole("note")).toHaveTextContent(
      "Always read labels before serving. An incomplete check is not a clean bill."
    );
    expect(screen.queryByText(/not medical advice/i)).not.toBeInTheDocument();
  });
});
