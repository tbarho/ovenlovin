import { describe, expect, it } from "vitest";
import { buildLlmsTxt, OVENLOVIN_PITCH } from "./llms-txt";

describe("buildLlmsTxt", () => {
  it("includes this instance's MCP, REST, and the pitch", () => {
    const text = buildLlmsTxt("https://kitchen.example.test/");
    expect(text).toContain(OVENLOVIN_PITCH);
    expect(text).toContain("https://kitchen.example.test/mcp");
    expect(text).toContain("https://kitchen.example.test/api/v1/openapi.json");
    expect(text).toContain("Authorization: ApiKey");
    expect(text).toContain("https://<your-app>.vercel.app/api/v1");
    expect(text).toContain("https://<your-app>.vercel.app/mcp");
    expect(text).toContain("Settings, then API keys");
    expect(text).toContain("`plaintext` value (shown once)");
    expect(text).not.toMatch(/ovenlovin\.vercel\.app/);
    expect(text).not.toMatch(/No account\?/);
    expect(text).not.toMatch(/after signing in/i);
    expect(text).toContain("X-Kitchen-Id");
    expect(text).toContain("mismatched `X-Kitchen-Id` is `403`");
    expect(text).toContain("https://tbarho.github.io/ovenlovin/docs/reference/api/");
    expect(text).toContain("whoami");
    expect(text).toContain("import_recipe_from_image");
    expect(text).toContain("edit_meal_plan");
    expect(text).toContain("manage_kitchen_invites");
    expect(text).toContain("manage_kitchen_members");
    expect(text.match(/^- [a-z_]+$/gm)?.length).toBe(26);
    expect(text).toContain("GET/POST /api/v1/recipes");
    expect(text).toContain("GET/POST /api/v1/meal-plans/{id}/check");
    expect(text).toContain(
      "Just looking? The public demo at https://ovenlovin-demo.vercel.app issues a 24h sandbox key at /api/demo/enter?format=json."
    );
    expect(text).toContain("curl -H 'Authorization: ApiKey $KEY'");
    expect(text).toContain("There is no llms-full.txt");
    expect(text).toContain("Not medical advice");
    expect(text).toContain("problems/forbidden");
    expect(text).toContain("HEAD is treated as GET");
    expect(text).toContain("session-only");
    expect(text).toContain("malformed or foreign id");
    expect(text).toContain("-32003");
    expect(text).toContain('data.code "forbidden"');
    expect(text).toContain("id arrays must be UUIDs");
  });
});
