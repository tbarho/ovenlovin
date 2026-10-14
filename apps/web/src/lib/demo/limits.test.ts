import { describe, expect, it } from "vitest";
import { decideDemoWrite } from "./limits";

const counters = {
  importCount: 0,
  writesInWindow: 0,
  windowStartedAt: new Date("2026-10-14T00:00:00.000Z"),
};

describe("decideDemoWrite", () => {
  it("allows reads without incrementing", () => {
    const decision = decideDemoWrite({
      pathname: "/api/v1/recipes",
      method: "GET",
      counters,
    });
    expect(decision.ok).toBe(true);
    if (decision.ok) expect(decision.next.writesInWindow).toBe(0);
  });

  it("blocks image uploads", () => {
    const decision = decideDemoWrite({
      pathname: "/api/v1/uploads/images",
      method: "POST",
      counters,
    });
    expect(decision).toMatchObject({ ok: false, code: "uploads_off" });
  });

  it("caps imports at five", () => {
    const decision = decideDemoWrite({
      pathname: "/api/v1/recipes/import",
      method: "POST",
      counters: { ...counters, importCount: 5 },
    });
    expect(decision).toMatchObject({ ok: false, code: "import_cap" });
  });

  it("rate-limits writes after 60 in the hour", () => {
    const decision = decideDemoWrite({
      pathname: "/api/v1/recipes",
      method: "POST",
      counters: { ...counters, writesInWindow: 60 },
      now: new Date("2026-10-14T00:30:00.000Z"),
    });
    expect(decision).toMatchObject({ ok: false, code: "write_rate" });
  });

  it("resets the write window after an hour", () => {
    const decision = decideDemoWrite({
      pathname: "/api/v1/recipes",
      method: "POST",
      counters: {
        importCount: 0,
        writesInWindow: 60,
        windowStartedAt: new Date("2026-10-14T00:00:00.000Z"),
      },
      now: new Date("2026-10-14T01:00:00.000Z"),
    });
    expect(decision.ok).toBe(true);
    if (decision.ok) expect(decision.next.writesInWindow).toBe(1);
  });
});
