import { describe, it, expect } from "vitest";
import { VERSION } from "./index";

describe("@ovenlovin/core", () => {
  it("exports VERSION", () => {
    expect(VERSION).toBeDefined();
  });
});
