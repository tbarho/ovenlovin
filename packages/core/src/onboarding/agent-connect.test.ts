import { describe, expect, it } from "vitest";
import { buildAgentGuides, buildRecimeMigratePrompt, normalizeOrigin } from "./agent-connect";

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

  it("builds a ReciMe migrate prompt with this instance URL and field names", () => {
    const prompt = buildRecimeMigratePrompt({ origin: "https://ovenlovin.vercel.app/" });
    expect(prompt).toContain("https://ovenlovin.vercel.app");
    expect(prompt).toContain("https://ovenlovin.vercel.app/mcp");
    expect(prompt).toContain("https://ovenlovin.vercel.app/api/v1");
    expect(prompt).toContain("https://recime.app");
    expect(prompt).toContain("YOUR_OVENLOVIN_API_KEY");
    expect(prompt).toContain("prepTimeMinutes");
    expect(prompt).toContain("cookTimeMinutes");
    expect(prompt).toContain("images[]");
    expect(prompt).toContain("source.url");
    expect(prompt).toContain("POST https://ovenlovin.vercel.app/api/v1/cookbooks");
    expect(prompt).toContain("manage_cookbook");
    expect(prompt).not.toContain("PR #");
    expect(prompt).toContain("Do not invent endpoints");
    expect(prompt).toContain("cookbookId=");
    expect(prompt).toContain("/uploads/images");
    expect(prompt).toContain("De-duplicate by source URL");
  });

  it("substitutes a generated API key when provided", () => {
    const [grok] = buildAgentGuides({
      origin: "https://kitchen.example",
      apiKey: "rkapi_test",
    });
    expect(grok?.content).toContain("ApiKey rkapi_test");
    expect(grok?.content).not.toContain("YOUR_OVENLOVIN_API_KEY");

    const recime = buildRecimeMigratePrompt({
      origin: "https://kitchen.example",
      apiKey: "rkapi_test",
    });
    expect(recime).toContain("ApiKey rkapi_test");
    expect(recime).not.toContain("YOUR_OVENLOVIN_API_KEY");
  });
});
