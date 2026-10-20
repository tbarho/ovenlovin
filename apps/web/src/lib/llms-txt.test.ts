import { describe, expect, it } from "vitest";
import { buildLlmsTxt, OVENLOVIN_PITCH } from "./llms-txt";

describe("buildLlmsTxt", () => {
  it("includes this instance's MCP, REST, and the pitch", () => {
    const text = buildLlmsTxt("https://ovenlovin.vercel.app/");
    expect(text).toContain(OVENLOVIN_PITCH);
    expect(text).toContain("https://ovenlovin.vercel.app/mcp");
    expect(text).toContain("https://ovenlovin.vercel.app/api/v1/openapi.json");
    expect(text).toContain("Authorization: ApiKey");
    expect(text).toContain("X-Kitchen-Id");
    expect(text).toContain("whoami");
    expect(text).toContain(
      "POST /api/v1/recipes/import (preview unless save:true; body source/content)"
    );
    expect(text).toContain("Not medical advice");
  });
});
