import { describe, expect, it, vi } from "vitest";
import { emitRecipeIngredientsRemoved, onRecipeIngredientsRemoved } from "./recipe-events";

describe("recipe ingredient events", () => {
  it("passes removed lines to listeners until they unsubscribe", () => {
    const listener = vi.fn();
    const off = onRecipeIngredientsRemoved(listener);
    emitRecipeIngredientsRemoved("recipe-1", ["2 eggs"]);
    emitRecipeIngredientsRemoved("recipe-1", []);
    off();
    emitRecipeIngredientsRemoved("recipe-1", ["1 cup milk"]);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith("recipe-1", ["2 eggs"]);
  });

  it("never lets a failing listener throw into the recipe write", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const after = vi.fn();
    const offBad = onRecipeIngredientsRemoved(() => {
      throw new Error("boom");
    });
    const offGood = onRecipeIngredientsRemoved(after);
    expect(() => emitRecipeIngredientsRemoved("recipe-1", ["2 eggs"])).not.toThrow();
    expect(after).toHaveBeenCalled();
    offBad();
    offGood();
    error.mockRestore();
  });
});
