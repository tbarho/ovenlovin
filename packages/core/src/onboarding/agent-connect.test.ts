import { describe, expect, it } from "vitest";
import { buildAgentGuides, normalizeOrigin } from "./agent-connect";

describe("buildAgentGuides", () => {
  it("fills this instance's MCP and REST URLs", () => {
    const guides = buildAgentGuides({ origin: "https://ovenlovin.vercel.app/" });
    expect(normalizeOrigin("https://ovenlovin.vercel.app/")).toBe("https://ovenlovin.vercel.app");

    const grok = guides.find((g) => g.id === "grok");
    expect(grok?.content).toContain("https://ovenlovin.vercel.app/mcp");
    expect(grok?.content).toContain("YOUR_OVENLOVIN_API_KEY");

    const chatgpt = guides.find((g) => g.id === "chatgpt");
    expect(chatgpt?.content).toContain("https://ovenlovin.vercel.app/api/v1/openapi.json");
    expect(chatgpt?.content).toContain("https://ovenlovin.vercel.app/api/v1");
  });

  it("substitutes a generated API key when provided", () => {
    const [grok] = buildAgentGuides({
      origin: "https://kitchen.example",
      apiKey: "rkapi_test",
    });
    expect(grok?.content).toContain("ApiKey rkapi_test");
    expect(grok?.content).not.toContain("YOUR_OVENLOVIN_API_KEY");
  });
});
