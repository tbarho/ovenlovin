import { describe, expect, it } from "vitest";
import { generateOpenApiDocument } from "./openapi";

describe("generateOpenApiDocument", () => {
  it("uses this instance as the server URL and documents API key auth", () => {
    const spec = generateOpenApiDocument("https://kitchen.example");
    expect(spec.servers?.[0]?.url).toBe("https://kitchen.example/api/v1");
    expect(spec.servers?.[0]?.url).not.toContain("your-app.vercel.app");
    expect(spec.info.version).toBe("0.1.0");
    expect(spec.components?.securitySchemes).toHaveProperty("apiKey");
    expect(spec.security).toEqual([{ apiKey: [] }, { bearerAuth: [] }]);
  });

  it("includes meal plans, households, people, and api-keys", () => {
    const spec = generateOpenApiDocument("https://ovenlovin.vercel.app");
    const paths = Object.keys(spec.paths ?? {});
    expect(paths).toEqual(
      expect.arrayContaining([
        "/recipes",
        "/recipes/{id}",
        "/meal-plans",
        "/meal-plans/{id}",
        "/meal-plans/{id}/check",
        "/meal-plans/{id}/shopping-list",
        "/households",
        "/households/schedule",
        "/people",
        "/people/{id}",
        "/people/{id}/rules",
        "/people/{id}/preferences",
        "/api-keys",
      ])
    );
    expect(spec.paths?.["/recipes"]?.get).toBeTruthy();
    expect(JSON.stringify(spec.paths?.["/recipes"]?.get)).toContain("forAttendees");
    expect(spec.paths?.["/recipes"]?.post).toBeTruthy();
    expect(spec.paths?.["/recipes/{id}"]?.delete).toBeTruthy();
    const recipe = spec.components?.schemas?.Recipe as { properties?: Record<string, unknown> };
    expect(recipe?.properties).toHaveProperty("notes");
    expect(spec.paths?.["/meal-plans/{id}"]?.delete).toBeTruthy();
  });

  it("documents meal-plan POST and PATCH bodies with entries and no silent extras", () => {
    const spec = generateOpenApiDocument("https://kitchen.example");
    const postBody = spec.paths?.["/meal-plans"]?.post?.requestBody as
      { content?: { "application/json"?: { schema?: Record<string, unknown> } } } | undefined;
    const patchBody = spec.paths?.["/meal-plans/{id}"]?.patch?.requestBody as
      { content?: { "application/json"?: { schema?: Record<string, unknown> } } } | undefined;

    const postSchema = resolveSchema(
      spec as { components?: { schemas?: Record<string, Record<string, unknown>> } },
      postBody?.content?.["application/json"]?.schema
    );
    const patchSchema = resolveSchema(
      spec as { components?: { schemas?: Record<string, Record<string, unknown>> } },
      patchBody?.content?.["application/json"]?.schema
    );

    expect(postSchema.properties).toHaveProperty("entries");
    expect(postSchema.properties).toHaveProperty("weekStart");
    expect(postSchema.additionalProperties).toBe(false);

    expect(patchSchema.properties).toHaveProperty("entries");
    expect(patchSchema.properties).toHaveProperty("status");
    expect(patchSchema.additionalProperties).toBe(false);
  });
});

function resolveSchema(
  spec: { components?: { schemas?: Record<string, Record<string, unknown>> } },
  schema: Record<string, unknown> | undefined
): Record<string, unknown> {
  if (!schema) return {};
  const ref = schema.$ref;
  if (typeof ref === "string") {
    const name = ref.split("/").pop();
    if (name && spec.components?.schemas?.[name]) {
      return spec.components.schemas[name];
    }
  }
  return schema;
}
