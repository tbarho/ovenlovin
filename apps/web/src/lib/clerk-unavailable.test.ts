import { describe, expect, it } from "vitest";
import { clerkUnavailableCopy } from "./clerk-unavailable";

describe("clerkUnavailableCopy", () => {
  it("hides env-var jargon in demo mode", () => {
    const copy = clerkUnavailableCopy(true);
    expect(copy.title).toMatch(/isn't available in the demo/i);
    expect(copy.body).not.toMatch(/CLERK|NEXT_PUBLIC/);
    expect(copy.href).toBe("/api/demo/enter?next=%2Frecipes");
  });
});
