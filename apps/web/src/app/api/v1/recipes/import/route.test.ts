import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("dns/promises", () => ({
  lookup: vi.fn(async () => [{ address: "93.184.216.34", family: 4 }]),
}));
import { NextRequest } from "next/server";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { IMPORT_BLOCKED_CODE, IMPORT_BLOCKED_MESSAGE } from "@ovenlovin/core";

const fixtures = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../../../../../packages/importers/src/__tests__/fixtures/url"
);

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

function food52LayeredFetch(requested: string) {
  if (requested.includes("jina") || requested.includes("translate")) {
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      url: requested,
      text: async () => readFileSync(join(fixtures, "food52-nav-chrome.html"), "utf8"),
    };
  }
  return {
    ok: false,
    status: 429,
    statusText: "Too Many Requests",
    url: requested,
    headers: {
      get: (name: string) => (name.toLowerCase() === "x-vercel-mitigated" ? "challenge" : null),
    },
    text: async () => readFileSync(join(fixtures, "vercel-security-checkpoint.html"), "utf8"),
  };
}

describe("POST /recipes/import", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns import_blocked for a Food52 429 plus nav-chrome fallback", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (requested: string) => food52LayeredFetch(String(requested)))
    );
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

  it("returns instagram_blocked for a Reel link without fetching Instagram", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { POST } = await import("./route");
    const response = await POST(
      new NextRequest("http://localhost/api/v1/recipes/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          source: "url",
          content: "https://www.instagram.com/reel/C9mIsoButter/?igsh=1",
        }),
      })
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      code: "instagram_blocked",
      heading: "Instagram did not let us read this post",
      permalink: "https://www.instagram.com/reel/C9mIsoButter",
      nextSteps: [
        { id: "retry" },
        { id: "paste" },
        { id: "photo" },
      ],
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("previews a pasted caption with the creator credited", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      new NextRequest("http://localhost/api/v1/recipes/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          source: "paste",
          content: "Miso pasta\n\nServes 2\n8 oz spaghetti\n2 tbsp butter\n\n1. Boil the pasta.",
          sourceUrl: "https://www.instagram.com/reel/C9mIsoButter/",
          creator: "@weeknightwithmaya",
        }),
      })
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      preview: true,
      saved: false,
      source: {
        type: "social",
        author: "@weeknightwithmaya",
        url: "https://www.instagram.com/reel/C9mIsoButter",
      },
    });
  });
});
