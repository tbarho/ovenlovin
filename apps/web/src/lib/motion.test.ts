import { describe, expect, it } from "vitest";
import { MOTION_SECONDS, presenceTransition } from "./motion";

describe("motion tokens", () => {
  it("collapses to zero duration when reduced motion is requested", () => {
    expect(presenceTransition(true, "sheet")).toEqual({ duration: 0 });
    expect(presenceTransition(true, "chip")).toEqual({ duration: 0 });
  });

  it("uses short token durations for meaningful motion", () => {
    expect(presenceTransition(false, "chip").duration).toBe(MOTION_SECONDS.fast);
    expect(presenceTransition(false, "sheet").duration).toBe(MOTION_SECONDS.sheet);
    expect(presenceTransition(false, "toast").duration).toBe(MOTION_SECONDS.base);
  });
});
