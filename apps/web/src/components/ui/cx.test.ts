import { describe, expect, it } from "vitest";
import { cx } from "./cx";

describe("cx", () => {
  it("joins truthy class names", () => {
    expect(cx("ds-button", false, undefined, "is-on")).toBe("ds-button is-on");
  });
});
