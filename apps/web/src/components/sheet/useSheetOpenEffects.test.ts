/** @vitest-environment jsdom */

import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { getSheetFocusableElements, useSheetOpenEffects } from "./useSheetOpenEffects";

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

describe("useSheetOpenEffects", () => {
  it("calls onClosed after focus is back on the opener", () => {
    document.body.innerHTML = `<button id="opener">Open</button><div id="panel"><input /></div>`;
    const opener = document.getElementById("opener") as HTMLElement;
    const panelRef = { current: document.getElementById("panel") as HTMLElement };
    opener.focus();
    const focusedOnClosed: (Element | null)[] = [];
    const onClosed = vi.fn(() => focusedOnClosed.push(document.activeElement));

    const { rerender } = renderHook(
      ({ open }) => useSheetOpenEffects({ open, onClose: () => {}, onClosed, panelRef }),
      { initialProps: { open: true } }
    );
    expect(document.activeElement?.tagName).toBe("INPUT");
    expect(onClosed).not.toHaveBeenCalled();

    rerender({ open: false });
    expect(onClosed).toHaveBeenCalledTimes(1);
    expect(focusedOnClosed[0]).toBe(opener);
  });
});
