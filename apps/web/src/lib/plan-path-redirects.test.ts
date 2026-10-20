import { describe, expect, it } from "vitest";
import { PLAN_PATH_REDIRECTS } from "./plan-path-redirects";

describe("PLAN_PATH_REDIRECTS", () => {
  it("sends /plan to /plans", () => {
    expect(PLAN_PATH_REDIRECTS).toEqual([
      { source: "/plan", destination: "/plans", permanent: true },
    ]);
  });
});
