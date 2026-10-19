import { describe, expect, it, vi } from "vitest";
import { API_KEY_CREATOR_NOT_A_MEMBER } from "@ovenlovin/core";

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
            id: "33333333-3333-4333-8333-333333333333",
            householdId: "22222222-2222-4222-8222-222222222222",
            createdBy: "11111111-1111-4111-8111-111111111111",
            scopes: ["recipes:read"],
          },
        };
      }
    },
    HouseholdService: class {
      async getMembershipsForUser() {
        return [];
      }
    },
  };
});

describe("removed member API keys", () => {
  it("rejects an MCP tool call when the key creator left the kitchen", async () => {
    const { authenticateRequest } = await import("./index");
    const { handleHttpRequest } = await import("../transport/http");
    const response = await handleHttpRequest(
      null,
      {
        method: "POST",
        body: {
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: { name: "search_recipes", arguments: {} },
        },
        headers: { Authorization: "ApiKey rkapi_removed" },
      },
      {
        requireAuth: true,
        onAuth: async (header) => authenticateRequest({ Authorization: header }),
      }
    );
    expect(response.status).toBe(401);
    expect(JSON.parse(response.body)).toMatchObject({
      jsonrpc: "2.0",
      id: 1,
      error: { message: API_KEY_CREATOR_NOT_A_MEMBER },
    });
  });
});
