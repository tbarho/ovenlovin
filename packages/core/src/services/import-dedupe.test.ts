import { describe, expect, it } from "vitest";
import { resolveDedupeClaim } from "./import-dedupe";

describe("resolveDedupeClaim", () => {
  const now = new Date("2026-10-19T12:00:00.000Z");

  it("replays a completed recipe id", () => {
    expect(
      resolveDedupeClaim(
        { status: "completed", recipeId: "11111111-1111-4111-8111-111111111111", expiresAt: null },
        now
      )
    ).toBe("completed");
  });

  it("holds an unexpired in-flight lock", () => {
    expect(
      resolveDedupeClaim(
        {
          status: "in_flight",
          recipeId: null,
          expiresAt: new Date("2026-10-19T12:02:00.000Z"),
        },
        now
      )
    ).toBe("in_flight");
  });

  it("lets a later retry steal an expired lock", () => {
    expect(
      resolveDedupeClaim(
        {
          status: "in_flight",
          recipeId: null,
          expiresAt: new Date("2026-10-19T11:59:00.000Z"),
        },
        now
      )
    ).toBe("steal");
  });
});
