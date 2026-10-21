import { describe, expect, it } from "vitest";
import { buildLlmsTxt, OVENLOVIN_PITCH } from "./llms-txt";

describe("buildLlmsTxt", () => {
  it("includes this instance's MCP, REST, and the pitch", () => {
    const text = buildLlmsTxt("https://ovenlovin.vercel.app/");
    expect(text).toContain(OVENLOVIN_PITCH);
    expect(text).toContain("https://ovenlovin.vercel.app/mcp");
    expect(text).toContain("https://ovenlovin.vercel.app/api/v1/openapi.json");
    expect(text).toContain("Authorization: ApiKey");
    expect(text).toContain("sandbox key");
    expect(text).not.toMatch(/after signing in/i);
    expect(text).toContain("X-Kitchen-Id");
    expect(text).toContain("mismatched");
    expect(text).toContain("whoami");
    expect(text).toContain("import_recipe_from_image");
    expect(text).toContain("edit_meal_plan");
    expect(text).toContain("manage_kitchen_invites");
    expect(text).toContain("manage_kitchen_members");
    expect(text.match(/^- [a-z_]+$/gm)?.length).toBe(26);
    expect(text).toContain("GET/POST /api/v1/recipes");
    expect(text).toContain("GET/POST /api/v1/meal-plans/{id}/check");
    expect(text).toContain("ovenlovin-demo.vercel.app/api/demo/enter?format=json");
    expect(text).toContain("curl -H 'Authorization: ApiKey $KEY'");
    expect(text).toContain("There is no llms-full.txt");
    expect(text).toContain("Not medical advice");
  });
});
