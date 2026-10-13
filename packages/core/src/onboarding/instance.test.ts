import { describe, expect, it } from "vitest";
import { DEFAULT_INSTANCE_NAME, getInstanceName } from "./instance";

describe("getInstanceName", () => {
  it("defaults when the name is missing or blank", () => {
    expect(getInstanceName()).toBe(DEFAULT_INSTANCE_NAME);
    expect(getInstanceName("   ")).toBe(DEFAULT_INSTANCE_NAME);
  });

  it("uses the deployer's instance name", () => {
    expect(getInstanceName("The Barho Kitchen")).toBe("The Barho Kitchen");
  });
});
