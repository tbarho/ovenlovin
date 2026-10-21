import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { IMPORT_BLOCKED_CODE, IMPORT_BLOCKED_MESSAGE } from "@ovenlovin/core";

vi.mock("@ovenlovin/db", () => ({
  getDatabase: () => ({}),
}));

vi.mock("@/lib/api/middleware", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/middleware")>();
  return {
    ...actual,
    getRequestContext: async () => ({
      userId: "11111111-1111-4111-8111-111111111111",
      householdId: "22222222-2222-4222-8222-222222222222",
      membershipRole: "owner" as const,
    }),
  };
});

vi.mock("@ovenlovin/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@ovenlovin/core")>();
  return {
    ...actual,
    RecipeService: class {
      findUrlImportCollision() {
        return null;
      }
    },
  };
});

vi.mock("@ovenlovin/importers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@ovenlovin/importers")>();
  return {
    ...actual,
    createUrlImporter: () => ({
      extract: async () => {
        throw new actual.RecipeImportFetchError("https://food52.com/x", 429, "Too Many Requests");
      },
    }),
  };
});

describe("POST /recipes/import", () => {
  it("keeps import_blocked on a classified fetch error", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      new NextRequest("http://localhost/api/v1/recipes/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          source: "url",
          content: "https://food52.com/recipes/chili",
        }),
      })
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      code: IMPORT_BLOCKED_CODE,
      detail: IMPORT_BLOCKED_MESSAGE,
    });
  });
});
