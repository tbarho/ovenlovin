import { describe, expect, it } from "vitest";
import { generateOpenApiDocument } from "./openapi";

describe("generateOpenApiDocument", () => {
  it("uses this instance as the server URL and documents API key auth", () => {
    const spec = generateOpenApiDocument("https://kitchen.example");
    expect(spec.servers?.[0]?.url).toBe("https://kitchen.example/api/v1");
    expect(spec.servers?.[0]?.url).not.toContain("your-app.vercel.app");
    expect(generateOpenApiDocument().servers?.[0]?.url).toBe("https://your-app.vercel.app/api/v1");
    expect(spec.info.version).toBe("0.1.0");
    expect(spec.components?.securitySchemes).toHaveProperty("apiKey");
    expect(spec.security).toEqual([{ apiKey: [] }, { bearerAuth: [] }]);
    expect(JSON.stringify(spec.components?.securitySchemes)).toMatch(/mismatched `X-Kitchen-Id`/);
  });

  it("includes meal plans, households, people, and api-keys", () => {
    const spec = generateOpenApiDocument("https://ovenlovin.vercel.app");
    const paths = Object.keys(spec.paths ?? {});
    expect(paths).toEqual(
      expect.arrayContaining([
        "/status",
        "/recipes",
        "/recipes/{id}",
        "/recipes/{id}/image",
        "/recipes/import",
        "/recipes/import/page",
        "/recipes/import/photo",
        "/meal-plans",
        "/meal-plans/{id}",
        "/meal-plans/{id}/undo",
        "/meal-plans/{id}/history",
        "/meal-plans/{id}/check",
        "/meal-plans/{id}/shopping-list",
        "/meal-plans/{id}/shopping-list/state",
        "/households",
        "/households/settings",
        "/households/schedule",
        "/households/mine",
        "/households/members",
        "/households/invites",
        "/invites/{token}",
        "/invites/{token}/accept",
        "/people",
        "/people/{id}",
        "/people/{id}/rules",
        "/people/{id}/preferences",
        "/api-keys",
      ])
    );
    expect(spec.paths?.["/health"]?.get).toBeTruthy();
    expect(spec.paths?.["/openapi.json"]?.get).toBeTruthy();
    expect(spec.paths?.["/status"]?.get).toBeTruthy();
    expect(spec.paths?.["/recipes/{id}/image"]?.post).toBeTruthy();
    expect(spec.paths?.["/cookbooks/{id}/recipes"]?.delete).toBeTruthy();
    expect(spec.paths?.["/people/{id}/rules/{ruleId}"]?.get).toBeTruthy();
    expect(spec.paths?.["/people/{id}/rules/{ruleId}"]?.patch).toBeTruthy();
    expect(spec.paths?.["/people/{id}/preferences/{prefId}"]?.get).toBeTruthy();
    expect(spec.paths?.["/households"]?.patch).toBeTruthy();
    expect(JSON.stringify(spec.paths?.["/recipes"]?.get)).not.toContain('"maximum":100');
    expect(JSON.stringify(spec.paths?.["/recipes"]?.get)).toContain("status");
    expect(JSON.stringify(spec.paths?.["/recipes"]?.get)).toContain("nextCursor");
    expect(JSON.stringify(spec.paths?.["/recipes"]?.get)).toContain("hasMore");
    expect(spec.paths?.["/recipes"]?.get?.responses?.["401"]).toBeTruthy();
    expect(spec.paths?.["/recipes"]?.get?.responses?.["400"]).toBeTruthy();
    expect(spec.paths?.["/recipes"]?.get?.responses?.["404"]).toBeTruthy();
    expect(spec.paths?.["/health"]?.get?.responses?.["401"]).toBeUndefined();
    expect(spec.paths?.["/health"]?.get?.responses?.["400"]).toBeUndefined();
    expect(spec.paths?.["/health"]?.get?.responses?.["404"]).toBeUndefined();
    expect(spec.paths?.["/status"]?.get?.responses?.["400"]).toBeUndefined();
    expect(spec.paths?.["/status"]?.get?.responses?.["404"]).toBeUndefined();
    expect(spec.paths?.["/openapi.json"]?.get?.responses?.["400"]).toBeUndefined();
    expect(spec.paths?.["/openapi.json"]?.get?.responses?.["404"]).toBeUndefined();
    expect(spec.paths?.["/invites/{token}"]?.get?.responses).toHaveProperty("404");
    expect(spec.paths?.["/invites/{token}"]?.get?.responses).toHaveProperty("410");
    const configStatus = spec.components?.schemas?.ConfigStatus as {
      properties?: Record<string, unknown>;
    };
    expect(configStatus?.properties).toHaveProperty("commitSha");
    expect(spec.paths?.["/recipes"]?.get).toBeTruthy();
    expect(JSON.stringify(spec.paths?.["/recipes"]?.get)).toContain("forAttendees");
    expect(JSON.stringify(spec.paths?.["/recipes"]?.get)).toContain("hiddenCount");
    expect(JSON.stringify(spec.paths?.["/recipes"]?.get)).toContain("hidden");
    expect(spec.paths?.["/recipes"]?.post).toBeTruthy();
    expect(spec.paths?.["/recipes/import"]?.post).toBeTruthy();
    expect(JSON.stringify(spec.paths?.["/recipes/import"]?.post)).toContain("save");
    expect(JSON.stringify(spec.paths?.["/recipes/import"]?.post)).toContain("saved:false");
    expect(JSON.stringify(spec.paths?.["/recipes/import"]?.post)).toContain("Idempotency-Key");
    expect(JSON.stringify(spec.paths?.["/recipes/import"]?.post)).toContain("draft");
    expect(JSON.stringify(spec.paths?.["/recipes/import/photo"]?.post)).toContain("allowDuplicate");
    expect(JSON.stringify(spec.paths?.["/recipes/import/photo"]?.post)).toContain("PNG");
    expect(spec.paths?.["/recipes/import/page"]?.post).toBeTruthy();
    expect(spec.paths?.["/recipes/import/photo"]?.post).toBeTruthy();
    expect(spec.paths?.["/recipes/import/photo"]?.post?.responses?.["409"]).toBeTruthy();
    const photoPreview = spec.components?.schemas?.PhotoImportPreview as {
      properties?: Record<string, unknown>;
    };
    expect(photoPreview?.properties).toHaveProperty("uncertainFields");
    expect(photoPreview?.properties).toHaveProperty("reviewReasons");
    expect(photoPreview?.properties).toHaveProperty("allergenClassifications");
    expect(spec.paths?.["/recipes/{id}"]?.delete).toBeTruthy();
    const recipe = spec.components?.schemas?.Recipe as { properties?: Record<string, unknown> };
    expect(recipe?.properties).toHaveProperty("notes");
    expect(recipe?.properties).toHaveProperty("reviewReasons");
    expect(recipe?.properties).toHaveProperty("remainingImports");
    expect(JSON.stringify(spec.paths?.["/recipes/{id}"]?.get)).toContain("displayServings");
    expect(JSON.stringify(spec.paths?.["/recipes/{id}"]?.get)).toContain("?servings");
    expect(spec.paths?.["/meal-plans/{id}"]?.delete).toBeTruthy();
    expect(spec.paths?.["/meal-plans/{id}/check"]?.get).toBeTruthy();
    expect(spec.paths?.["/meal-plans/{id}/check"]?.post).toBeTruthy();
    expect(JSON.stringify(spec.paths?.["/meal-plans/{id}/shopping-list"]?.get)).toContain(
      "includeStaples"
    );
    expect(JSON.stringify(spec.paths?.["/meal-plans/{id}/shopping-list"]?.get)).toContain(
      "includePantryItems"
    );
    expect(spec.paths?.["/meal-plans/{id}/shopping-list/state"]?.get).toBeTruthy();
    expect(spec.paths?.["/meal-plans/{id}/shopping-list/state"]?.patch).toBeTruthy();
    const tripState = spec.components?.schemas?.ShoppingTripState as {
      properties?: Record<string, unknown>;
      additionalProperties?: unknown;
    };
    expect(tripState?.properties).toHaveProperty("checkedKeys");
    expect(tripState?.properties).toHaveProperty("extras");
    expect(tripState?.additionalProperties).toBe(false);
    const shoppingList = spec.components?.schemas?.ShoppingList as {
      properties?: Record<string, { description?: string }>;
    };
    expect(shoppingList?.properties).toHaveProperty("includeStaples");
    expect(shoppingList?.properties).toHaveProperty("includePantryItems");
    expect(shoppingList?.properties?.includePantryItems?.description).toMatch(/deprecated alias/i);
    const shoppingItem = spec.components?.schemas?.ShoppingListIngredient as {
      properties?: Record<string, { description?: string }>;
    };
    expect(shoppingItem?.properties).toHaveProperty("isStaple");
    expect(shoppingItem?.properties).toHaveProperty("isPantryItem");
    expect(shoppingItem?.properties?.isPantryItem?.description).toMatch(/deprecated alias/i);
    expect(JSON.stringify(spec.paths?.["/meal-plans/{id}/shopping-list"]?.get)).toContain(
      "timeZone"
    );
    expect(JSON.stringify(spec.paths?.["/households/mine"]?.get)).toMatch(/API key/);
    expect(JSON.stringify(spec.paths?.["/households/mine"]?.get)).toMatch(/active/);
    expect(JSON.stringify(spec.paths?.["/invites/{token}/accept"]?.post)).toMatch(/signed-in/);
    expect(spec.paths?.["/recipes"]?.get?.responses?.["403"]).toEqual({
      $ref: "#/components/responses/Forbidden",
    });
    expect(spec.paths?.["/recipes"]?.post?.responses?.["403"]).toEqual({
      $ref: "#/components/responses/Forbidden",
    });
    expect(JSON.stringify(spec.components?.responses?.Forbidden)).toMatch(/problems\/forbidden/);
    expect(JSON.stringify(spec.components?.responses?.Forbidden)).toMatch(/missing scope/);
    expect(JSON.stringify(spec.components?.responses?.Forbidden)).toMatch(/role not allowed/);
    expect(JSON.stringify(spec.components?.responses?.Forbidden)).toMatch(/X-Kitchen-Id/);
    expect(JSON.stringify(spec.components?.responses?.Forbidden)).toMatch(/demo write\/upload cap/);
    expect(JSON.stringify(spec.paths?.["/recipes/{id}"]?.get?.responses?.["404"])).toMatch(
      /malformed or foreign id/
    );
    expect(spec.paths?.["/api-keys"]?.get?.responses).not.toHaveProperty("403");
    expect(spec.paths?.["/api-keys"]?.post?.responses?.["403"]).toMatchObject({
      description: expect.stringMatching(/Admin or owner role required/),
    });
    expect(spec.paths?.["/api-keys"]?.post?.responses?.["403"]).not.toEqual({
      $ref: "#/components/responses/Forbidden",
    });
    expect(spec.paths?.["/api-keys/{id}"]?.delete?.responses?.["403"]).toMatchObject({
      description: expect.stringMatching(/Admin or owner role required/),
    });
    expect(spec.paths?.["/api-keys"]?.get?.responses).toHaveProperty("401");
    expect(spec.paths?.["/api-keys"]?.post?.responses).toHaveProperty("401");
    expect(spec.paths?.["/api-keys/{id}"]?.delete?.responses).toHaveProperty("401");
    expect(spec.paths?.["/status"]?.get?.responses).not.toHaveProperty("403");
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

    const postProps = postSchema.properties as Record<string, unknown> | undefined;
    const patchProps = patchSchema.properties as Record<string, unknown> | undefined;
    expect(postProps).toHaveProperty("entries");
    expect(postProps).toHaveProperty("weekStart");
    expect(postProps).toHaveProperty("cookFor");
    expect(JSON.stringify(postProps?.cookFor)).toMatch(/nullable|null/);
    expect(postSchema.additionalProperties).toBe(false);

    expect(patchProps).toHaveProperty("entries");
    expect(patchProps).toHaveProperty("status");
    expect(patchProps).toHaveProperty("cookFor");
    expect(JSON.stringify(patchProps?.cookFor)).toMatch(/nullable|null/);
    expect(patchSchema.properties).toHaveProperty("entriesMode");
    expect(patchSchema.additionalProperties).toBe(false);
    expect(JSON.stringify(spec.paths?.["/meal-plans/{id}"]?.patch)).toMatch(/merge/);
    expect(JSON.stringify(spec.paths?.["/meal-plans/{id}"]?.patch)).toMatch(/previousEntries/);
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
