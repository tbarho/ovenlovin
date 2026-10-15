import { describe, expect, it } from "vitest";
import { presentListedRecipe } from "./recipe-media";

const png =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

describe("presentListedRecipe", () => {
  it("never returns inline image bytes in list payloads", () => {
    const listed = presentListedRecipe(
      {
        id: "550e8400-e29b-41d4-a716-446655440000",
        title: "Test pancakes",
        images: [`data:image/png;base64,${png}`],
      },
      "https://kitchen.example"
    );
    expect(listed.images).toEqual([
      "https://kitchen.example/api/v1/recipes/550e8400-e29b-41d4-a716-446655440000/image",
    ]);
    expect(JSON.stringify(listed)).not.toContain("base64");
    expect(JSON.stringify(listed).length).toBeLessThan(400);
  });
});
