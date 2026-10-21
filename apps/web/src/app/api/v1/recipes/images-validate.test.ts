import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const createRecipe = vi.fn();
const persistImportedDraft = vi.fn();

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
            scopes: ["recipes:write"],
          },
        };
      }
    },
    HouseholdService: class {
      async getMembershipsForUser() {
        return [{ householdId: "22222222-2222-4222-8222-222222222222", role: "member" }];
      }
    },
    RecipeService: class {
      createRecipe = createRecipe;
      persistImportedDraft = persistImportedDraft;
    },
  };
});

describe("POST /recipes image validation", () => {
  it("returns 400 and does not persist object-shaped images", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      new NextRequest("http://localhost/api/v1/recipes", {
        method: "POST",
        headers: {
          Authorization: "ApiKey rkapi_test",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: "Parent A toast",
          ingredients: [{ rawText: "1 slice bread" }],
          steps: [{ text: "Toast it." }],
          images: [{ url: "https://example.com/a.png" }],
        }),
      })
    );
    expect(response.status).toBe(400);
    expect(createRecipe).not.toHaveBeenCalled();
    expect(persistImportedDraft).not.toHaveBeenCalled();
  });
});
