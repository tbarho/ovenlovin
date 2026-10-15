import { describe, expect, it } from "vitest";
import { AI_GATEWAY_MISSING_MESSAGE, isAiGatewayConfigured, isDemoModeEnv } from "./ai-gateway";

describe("isAiGatewayConfigured", () => {
  it("is true when an explicit gateway key is set", () => {
    expect(isAiGatewayConfigured({ AI_GATEWAY_API_KEY: "key_123" })).toBe(true);
  });

  it("is true when a Vercel OIDC token is present", () => {
    expect(isAiGatewayConfigured({ VERCEL_OIDC_TOKEN: "oidc.token" })).toBe(true);
  });

  it("is true on a Vercel deployment even without a key", () => {
    expect(isAiGatewayConfigured({ VERCEL: "1" })).toBe(true);
  });

  it("is false when neither a key, OIDC token, nor Vercel runtime is present", () => {
    expect(isAiGatewayConfigured({})).toBe(false);
    expect(isAiGatewayConfigured({ VERCEL: "0" })).toBe(false);
    expect(isAiGatewayConfigured({ AI_GATEWAY_API_KEY: "  " })).toBe(false);
  });

  it("does not treat demo mode as missing credentials when a key or OIDC is present", () => {
    expect(
      isAiGatewayConfigured({
        OVENLOVIN_DEMO_MODE: "1",
        VERCEL: "1",
        AI_GATEWAY_API_KEY: "key_123",
      })
    ).toBe(true);
    expect(
      isAiGatewayConfigured({
        OVENLOVIN_DEMO_MODE: "1",
        VERCEL_OIDC_TOKEN: "oidc.token",
      })
    ).toBe(true);
    expect(isAiGatewayConfigured({ OVENLOVIN_DEMO_MODE: "1" })).toBe(false);
  });
});

describe("isDemoModeEnv", () => {
  it("reads the demo flag independently of gateway credentials", () => {
    expect(isDemoModeEnv({ OVENLOVIN_DEMO_MODE: "1" })).toBe(true);
    expect(isDemoModeEnv({ OVENLOVIN_DEMO_MODE: "true" })).toBe(true);
    expect(isDemoModeEnv({})).toBe(false);
  });
});

describe("AI_GATEWAY_MISSING_MESSAGE", () => {
  it("names both env vars an operator can set", () => {
    expect(AI_GATEWAY_MISSING_MESSAGE).toContain("AI_GATEWAY_API_KEY");
    expect(AI_GATEWAY_MISSING_MESSAGE).toContain("VERCEL_OIDC_TOKEN");
  });
});
