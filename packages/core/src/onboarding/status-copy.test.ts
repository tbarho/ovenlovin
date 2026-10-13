import { describe, expect, it } from "vitest";
import { describeConfigStatus } from "./status-copy";

describe("describeConfigStatus", () => {
  it("is ready only when every integration is configured and reachable", () => {
    const ready = describeConfigStatus({
      databaseConfigured: true,
      databaseReachable: true,
      clerkConfigured: true,
      aiGatewayConfigured: true,
    });
    expect(ready.ready).toBe(true);

    const missing = describeConfigStatus({
      databaseConfigured: false,
      clerkConfigured: true,
      aiGatewayConfigured: true,
    });
    expect(missing.ready).toBe(false);
    expect(missing.checks.find((c) => c.id === "database")?.detail).toMatch(/DATABASE_URL/);
  });

  it("does not claim the database is fine when the URL is set but unreachable", () => {
    const status = describeConfigStatus({
      databaseConfigured: true,
      databaseReachable: false,
      clerkConfigured: true,
      aiGatewayConfigured: true,
    });
    expect(status.ready).toBe(false);
    expect(status.checks.find((c) => c.id === "database")?.detail).toMatch(/could not reach/);
  });
});
