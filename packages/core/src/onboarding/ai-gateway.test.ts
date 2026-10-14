import { describe, expect, it } from "vitest";
import { isAiGatewayConfigured } from "./ai-gateway";

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
  });

  it("is false in demo mode even on Vercel with a gateway key", () => {
    expect(
      isAiGatewayConfigured({
        OVENLOVIN_DEMO_MODE: "1",
        VERCEL: "1",
        AI_GATEWAY_API_KEY: "key_123",
      })
    ).toBe(false);
  });
});
