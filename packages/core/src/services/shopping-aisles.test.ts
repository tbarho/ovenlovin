import { describe, expect, it } from "vitest";
import { assignAisle, isPantryStaple } from "./shopping-aisles";

describe("assignAisle", () => {
  it("maps fixture grocery names to store sections", () => {
    expect(assignAisle("yellow onion")).toEqual({ aisle: "Produce", category: "produce" });
    expect(assignAisle("shredded mozzarella")).toEqual({ aisle: "Dairy", category: "dairy" });
    expect(assignAisle("ziti")).toEqual({ aisle: "Grains", category: "grains" });
    expect(assignAisle("olive oil")).toEqual({ aisle: "Oils & vinegar", category: "pantry" });
    expect(assignAisle("acorn squash")).toEqual({ aisle: "Produce", category: "produce" });
  });

  it("does not put black pepper in produce", () => {
    expect(assignAisle("black pepper")).toEqual({ aisle: "Spices", category: "spices" });
    expect(assignAisle("bell pepper")).toEqual({ aisle: "Produce", category: "produce" });
  });
});

describe("isPantryStaple", () => {
  it("treats salt and oil as pantry staples", () => {
    expect(isPantryStaple("salt")).toBe(true);
    expect(isPantryStaple("kosher salt")).toBe(true);
    expect(isPantryStaple("olive oil")).toBe(true);
    expect(isPantryStaple("sesame oil")).toBe(true);
    expect(isPantryStaple("yellow onion")).toBe(false);
    expect(isPantryStaple("soy sauce")).toBe(false);
  });
});
