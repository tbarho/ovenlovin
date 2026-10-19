import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
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
  it("returns 401 on a recipe read when the key creator left the kitchen", async () => {
    const { GET } = await import("./route");
    const response = await GET(
      new NextRequest("http://localhost/api/v1/recipes", {
        headers: { Authorization: "ApiKey rkapi_removed" },
      })
    );
    expect(response.status).toBe(401);
    expect(response.headers.get("content-type")).toContain("application/problem+json");
    expect(await response.json()).toMatchObject({
      status: 401,
      detail: API_KEY_CREATOR_NOT_A_MEMBER,
    });
  });
});
