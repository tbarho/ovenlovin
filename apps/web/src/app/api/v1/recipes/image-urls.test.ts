import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const saveImportedRecipe = vi.fn();

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

vi.mock("@/lib/import-save", () => ({
  saveImportedRecipe: (...args: unknown[]) => saveImportedRecipe(...args),
  recipeFromPersist: (value: unknown) => value,
  withDemoImportQuota: (value: unknown) => value,
  isIdempotentReplay: () => false,
}));

describe("POST /recipes image URLs", () => {
  it("rejects a private image URL with 400 and does not persist", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      new NextRequest("http://localhost/api/v1/recipes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: "Toast",
          ingredients: [{ rawText: "1 slice bread" }],
          steps: [{ text: "Toast it." }],
          images: ["http://169.254.169.254/latest/meta-data/x.png"],
        }),
      })
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "invalid_image_url" });
    expect(saveImportedRecipe).not.toHaveBeenCalled();
  });
});
