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
    expect(ready.commitSha).toBeNull();

    const missing = describeConfigStatus({
      databaseConfigured: false,
      clerkConfigured: true,
      aiGatewayConfigured: true,
    });
    expect(missing.ready).toBe(false);
    expect(missing.checks.find((c) => c.id === "database")?.detail).toMatch(/DATABASE_URL/);
  });

  it("does not tell Vercel deploys to set AI_GATEWAY_API_KEY when the gateway is configured", () => {
    const status = describeConfigStatus({
      databaseConfigured: true,
      databaseReachable: true,
      clerkConfigured: true,
      aiGatewayConfigured: true,
    });
    expect(status.checks.find((c) => c.id === "aiGateway")?.detail).toMatch(/OIDC/);
    expect(status.checks.find((c) => c.id === "aiGateway")?.detail).not.toMatch(
      /Set AI_GATEWAY_API_KEY/
    );
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

  it("is ready on the demo when only the database works", () => {
    const status = describeConfigStatus({
      databaseConfigured: true,
      databaseReachable: true,
      clerkConfigured: false,
      aiGatewayConfigured: false,
      demoMode: true,
    });
    expect(status.ready).toBe(true);
    expect(status.mode).toBe("demo");
    expect(status.checks.find((c) => c.id === "clerk")?.detail).toMatch(/not required/);
    expect(status.checks.find((c) => c.id === "aiGateway")?.configured).toBe(false);
    expect(status.checks.find((c) => c.id === "aiGateway")?.detail).toMatch(/AI_GATEWAY_API_KEY/);
    expect(status.checks.find((c) => c.id === "aiGateway")?.detail).toMatch(/VERCEL_OIDC_TOKEN/);
    expect(status.checks.find((c) => c.id === "aiGateway")?.detail).toMatch(
      /URL and paste import still work/
    );
    expect(status.checks.find((c) => c.id === "blob")?.configured).toBe(false);
    expect(status.checks.find((c) => c.id === "blob")?.required).toBe(false);
    expect(status.checks.find((c) => c.id === "blob")?.detail).toMatch(/BLOB_READ_WRITE_TOKEN/);
  });

  it("reports when Vercel Blob is configured", () => {
    const status = describeConfigStatus({
      databaseConfigured: true,
      databaseReachable: true,
      clerkConfigured: true,
      aiGatewayConfigured: true,
      blobConfigured: true,
    });
    expect(status.checks.find((c) => c.id === "blob")?.configured).toBe(true);
    expect(status.checks.find((c) => c.id === "blob")?.detail).toMatch(/copied to Vercel Blob/);
  });

  it("reports AI Gateway from the shared configured flag, including on the demo", () => {
    const demoReady = describeConfigStatus({
      databaseConfigured: true,
      databaseReachable: true,
      clerkConfigured: false,
      aiGatewayConfigured: true,
      demoMode: true,
    });
    expect(demoReady.checks.find((c) => c.id === "aiGateway")?.configured).toBe(true);
    expect(demoReady.checks.find((c) => c.id === "aiGateway")?.detail).toMatch(/OIDC/);
    expect(demoReady.ready).toBe(true);
  });

  it("exposes the Vercel git commit SHA when provided", () => {
    const status = describeConfigStatus({
      databaseConfigured: true,
      databaseReachable: true,
      clerkConfigured: true,
      aiGatewayConfigured: true,
      commitSha: "7c77da5d6a4b42a12193ced572573d43ea2e71c3",
    });
    expect(status.commitSha).toBe("7c77da5d6a4b42a12193ced572573d43ea2e71c3");
  });
});
