import { describe, expect, it } from "vitest";
import { mcpRecipeImages } from "./media";

const png =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

describe("mcpRecipeImages", () => {
  it("returns a thumbnail URL instead of inline photo bytes", () => {
    const images = mcpRecipeImages(
      "550e8400-e29b-41d4-a716-446655440000",
      [`data:image/png;base64,${png}`],
      { NEXT_PUBLIC_APP_URL: "https://kitchen.example" }
    );
    expect(images).toEqual([
      "https://kitchen.example/api/v1/recipes/550e8400-e29b-41d4-a716-446655440000/image",
    ]);
    expect(JSON.stringify(images)).not.toContain("base64");
  });
});
