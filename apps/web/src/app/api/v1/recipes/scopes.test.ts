import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { API_KEY_SCOPES, missingScopeMessage } from "@ovenlovin/core";

const fixtures = vi.hoisted(() => ({
  scopes: ["recipes:read"] as string[],
}));

vi.mock("@ovenlovin/db", () => ({
  getDatabase: () => ({}),
}));

vi.mock("@ovenlovin/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@ovenlovin/core")>();
  return {
    ...actual,
    ApiKeyService: class {
      async validate() {
        return {
          valid: true,
          key: {
            id: "44444444-4444-4444-8444-444444444444",
            householdId: "22222222-2222-4222-8222-222222222222",
            createdBy: "11111111-1111-4111-8111-111111111111",
            scopes: fixtures.scopes,
          },
        };
      }
    },
    HouseholdService: class {
      async getMembershipsForUser() {
        return [{ householdId: "22222222-2222-4222-8222-222222222222", role: "owner" }];
      }
    },
    RecipeService: class {
      async listRecipes() {
        return { items: [], nextCursor: null, hasMore: false };
      }
    },
  };
});

function request(method: string, path: string, body?: unknown) {
  return new NextRequest(`http://localhost${path}`, {
    method,
    headers: {
      Authorization: "ApiKey rkapi_test",
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe("REST API key scopes", () => {
  it("lets a read-only key list recipes and forbids a create", async () => {
    fixtures.scopes = ["recipes:read"];
    const { GET, POST } = await import("./route");

    const listed = await GET(request("GET", "/api/v1/recipes"));
    expect(listed.status).toBe(200);
    expect(await listed.json()).toMatchObject({ items: [] });

    const created = await POST(
      request("POST", "/api/v1/recipes", { title: "Toast", ingredients: [], steps: [] })
    );
    expect(created.status).toBe(403);
    expect(created.headers.get("content-type")).toContain("application/problem+json");
    expect(await created.json()).toMatchObject({
      type: "http://localhost/problems/forbidden",
      title: "Forbidden",
      status: 403,
      detail: missingScopeMessage("recipes:write"),
    });
  });

  it("lets a full-scope key through to the create handler", async () => {
    fixtures.scopes = [...API_KEY_SCOPES];
    const { POST } = await import("./route");
    const created = await POST(
      request("POST", "/api/v1/recipes", {
        title: "Toast",
        images: [{ url: "https://example.com/a.png" }],
      })
    );
    expect(created.status).toBe(400);
    expect(created.status).not.toBe(403);
  });
});
