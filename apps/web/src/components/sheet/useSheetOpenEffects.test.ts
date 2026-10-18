/** @vitest-environment jsdom */

import { describe, expect, it } from "vitest";
import { getSheetFocusableElements } from "./useSheetOpenEffects";

describe("getSheetFocusableElements", () => {
  it("skips disabled and negative tabindex controls", () => {
    document.body.innerHTML = `
      <div id="panel">
        <button type="button">Close</button>
        <button type="button" disabled>Nope</button>
        <a href="/recipes">Recipes</a>
        <a tabindex="-1">Skip</a>
        <input />
      </div>
    `;
    const panel = document.getElementById("panel") as HTMLElement;
    expect(getSheetFocusableElements(panel).map((el) => el.textContent || el.tagName)).toEqual([
      "Close",
      "Recipes",
      "INPUT",
    ]);
  });
});
