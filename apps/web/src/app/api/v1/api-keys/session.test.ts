import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { API_KEY_SCOPES } from "@ovenlovin/core";

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
            scopes: [...API_KEY_SCOPES],
          },
        };
      }
    },
    HouseholdService: class {
      async getMembershipsForUser() {
        return [{ householdId: "22222222-2222-4222-8222-222222222222", role: "owner" }];
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

async function expectKeyRejected(response: Response) {
  expect(response.status).toBe(401);
  expect(response.headers.get("content-type")).toContain("application/problem+json");
  expect(await response.json()).toMatchObject({
    title: "Unauthorized",
    status: 401,
    detail: "User authentication required",
  });
}

describe("API keys are session-only", () => {
  it("returns 401 for an API key on GET, POST, and DELETE", async () => {
    const { GET, POST } = await import("./route");
    const { DELETE } = await import("./[id]/route");

    await expectKeyRejected(await GET(request("GET", "/api/v1/api-keys")));
    await expectKeyRejected(await POST(request("POST", "/api/v1/api-keys", { name: "Agent" })));
    await expectKeyRejected(
      await DELETE(request("DELETE", "/api/v1/api-keys/44444444-4444-4444-8444-444444444444"), {
        params: Promise.resolve({ id: "44444444-4444-4444-8444-444444444444" }),
      })
    );
  });
});
