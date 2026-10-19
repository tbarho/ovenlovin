import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/browser-api";
import { CaptureFromDevice } from "./CaptureFromDevice";

vi.mock("@/lib/browser-api", () => ({
  api: vi.fn(),
  apiErrorRecipeUrl: (error: unknown) => {
    if (!error || typeof error !== "object") return null;
    const url = (error as { recipeUrl?: unknown }).recipeUrl;
    return typeof url === "string" && url.startsWith("/") ? url : null;
  },
}));

describe("CaptureFromDevice", () => {
  beforeEach(() => {
    vi.mocked(api).mockReset();
    window.sessionStorage.clear();
  });

  it("posts the hash payload and opens the saved recipe", async () => {
    const hash = `#${encodeURIComponent(
      JSON.stringify({
        url: "https://www.budgetbytes.com/beef-stroganoff/",
        jsonLd: { "@type": "Recipe", name: "Beef Stroganoff" },
      })
    )}`;
    window.history.replaceState(null, "", `/recipes/import/capture${hash}`);
    vi.mocked(api).mockResolvedValue({
      id: "00000000-0000-4000-8000-000000000021",
      title: "Beef Stroganoff",
      servings: 4,
    });

    render(<CaptureFromDevice />);
    await waitFor(() => {
      expect(api).toHaveBeenCalledWith(
        "/api/v1/recipes/import/page",
        expect.objectContaining({ method: "POST" })
      );
    });
    const body = JSON.parse(String(vi.mocked(api).mock.calls[0]?.[1]?.body));
    expect(body.jsonLd.name).toBe("Beef Stroganoff");
    expect(
      JSON.parse(window.sessionStorage.getItem("ovenlovin.import-toast") ?? "{}")
    ).toMatchObject({ title: "Beef Stroganoff", servings: 4 });
  });

  it("links to the existing recipe when import/page returns 409", async () => {
    const hash = `#${encodeURIComponent(
      JSON.stringify({
        url: "https://www.budgetbytes.com/beef-stroganoff/",
        jsonLd: { "@type": "Recipe", name: "Beef Stroganoff" },
      })
    )}`;
    window.history.replaceState(null, "", `/recipes/import/capture${hash}`);
    vi.mocked(api).mockRejectedValue(
      Object.assign(new Error('This URL was already imported as "Beef Stroganoff".'), {
        recipeUrl: "/recipes/00000000-0000-4000-8000-000000000021",
      })
    );

    render(<CaptureFromDevice />);
    expect(await screen.findByText(/already imported/)).toBeVisible();
    expect(screen.getByRole("link", { name: "Open that recipe" })).toHaveAttribute(
      "href",
      "/recipes/00000000-0000-4000-8000-000000000021"
    );
  });

  it("explains an empty hash", async () => {
    window.history.replaceState(null, "", "/recipes/import/capture");
    render(<CaptureFromDevice />);
    expect(await screen.findByText(/No page was sent/)).toBeVisible();
    expect(api).not.toHaveBeenCalled();
  });
});
