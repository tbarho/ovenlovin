import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { API_KEY_KITCHEN_HEADER_MISMATCH } from "@ovenlovin/core";

const kitchenA = "22222222-2222-4222-8222-222222222222";
const kitchenB = "33333333-3333-4333-8333-333333333333";

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
            householdId: kitchenA,
            createdBy: "11111111-1111-4111-8111-111111111111",
            scopes: ["recipes:read"],
          },
        };
      }
    },
    HouseholdService: class {
      async getMembershipsForUser() {
        return [{ householdId: kitchenA, role: "member" }];
      }
    },
  };
});

describe("API key X-Kitchen-Id on REST", () => {
  it("rejects a header that does not match the key kitchen", async () => {
    const { getRequestContext } = await import("./middleware");
    await expect(
      getRequestContext(
        new NextRequest("http://localhost/api/v1/recipes", {
          headers: {
            Authorization: "ApiKey rkapi_test",
            "X-Kitchen-Id": kitchenB,
          },
        })
      )
    ).rejects.toMatchObject({
      status: 403,
      detail: API_KEY_KITCHEN_HEADER_MISMATCH,
    });
  });

  it("accepts a matching X-Kitchen-Id", async () => {
    const { getRequestContext } = await import("./middleware");
    const context = await getRequestContext(
      new NextRequest("http://localhost/api/v1/recipes", {
        headers: {
          Authorization: "ApiKey rkapi_test",
          "X-Kitchen-Id": kitchenA,
        },
      })
    );
    expect(context.householdId).toBe(kitchenA);
  });
});
