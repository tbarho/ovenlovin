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

describe("Clerk Bearer without CLERK_SECRET_KEY", () => {
  it("returns 401 without naming the missing secret", async () => {
    const previous = process.env.CLERK_SECRET_KEY;
    delete process.env.CLERK_SECRET_KEY;
    try {
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
            params: { name: "whoami", arguments: {} },
          },
          headers: { Authorization: "Bearer eyJhbGciOiJIUzI1NiJ9.e30.sig" },
        },
        {
          requireAuth: true,
          onAuth: async (header) => authenticateRequest({ Authorization: header }),
        }
      );
      expect(response.status).toBe(401);
      expect(response.body).not.toContain("CLERK_SECRET_KEY");
      expect(JSON.parse(response.body)).toMatchObject({
        jsonrpc: "2.0",
        id: 1,
        error: { message: "Bearer tokens are not supported on this server. Use ApiKey." },
      });
    } finally {
      if (previous === undefined) delete process.env.CLERK_SECRET_KEY;
      else process.env.CLERK_SECRET_KEY = previous;
    }
  });
});
