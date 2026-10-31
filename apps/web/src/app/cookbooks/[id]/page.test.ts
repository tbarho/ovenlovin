import { describe, expect, it, vi } from "vitest";

const redirect = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT ${url}`);
});
vi.mock("next/navigation", () => ({ redirect: (url: string) => redirect(url) }));

import CookbookPage from "./page";

describe("/cookbooks/[id]", () => {
  it("redirects to the cookbook on the recipes page instead of a 404", async () => {
    await expect(
      CookbookPage({ params: Promise.resolve({ id: "00000000-0000-4000-8000-000000000020" }) })
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/recipes?cookbook=00000000-0000-4000-8000-000000000020");
  });
});
