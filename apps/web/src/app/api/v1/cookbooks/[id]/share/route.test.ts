import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const HOUSEHOLD = "22222222-2222-4222-8222-222222222222";
const COOKBOOK = "33333333-3333-4333-8333-333333333333";
const TOKEN = `olbook_${"a".repeat(43)}`;

const shares = vi.hoisted(() => ({
  getStatus: vi.fn(),
  createLink: vi.fn(),
  revokeLink: vi.fn(),
}));
const loadOwnedCookbook = vi.hoisted(() => vi.fn());

vi.mock("@ovenlovin/db", () => ({ getDatabase: () => ({}) }));
vi.mock("@ovenlovin/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@ovenlovin/core")>();
  return {
    ...actual,
    CookbookShareService: class {
      getStatus = shares.getStatus;
      createLink = shares.createLink;
      revokeLink = shares.revokeLink;
    },
  };
});
vi.mock("@/lib/api/cookbooks", () => ({ loadOwnedCookbook }));
vi.mock("@/lib/api/middleware", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/middleware")>();
  return {
    ...actual,
    getRequestContext: async () => ({
      userId: "11111111-1111-4111-8111-111111111111",
      householdId: HOUSEHOLD,
      membershipRole: "owner" as const,
    }),
  };
});

import { ShareBlockedError, SHARE_BLOCKED_REASON } from "@ovenlovin/core";
import { NotFoundError } from "@/lib/api/errors";
import { DELETE, GET, POST } from "./route";

const params = () => ({ params: Promise.resolve({ id: COOKBOOK }) });
const request = (method: string) =>
  new NextRequest(`http://localhost/api/v1/cookbooks/${COOKBOOK}/share`, { method });

describe("/cookbooks/{id}/share", () => {
  beforeEach(() => {
    vi.stubEnv("OVENLOVIN_BOOKS", "1");
    loadOwnedCookbook.mockResolvedValue({ id: COOKBOOK, householdId: HOUSEHOLD });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("is not found while the books flag is off", async () => {
    vi.stubEnv("OVENLOVIN_BOOKS", "");
    expect((await GET(request("GET"), params())).status).toBe(404);
    expect((await POST(request("POST"), params())).status).toBe(404);
  });

  it("is not found for another kitchen's cookbook", async () => {
    loadOwnedCookbook.mockRejectedValue(new NotFoundError("Cookbook", COOKBOOK));
    expect((await POST(request("POST"), params())).status).toBe(404);
    expect(shares.createLink).not.toHaveBeenCalled();
  });

  it("returns the reader path, and the reason when blocked", async () => {
    shares.getStatus.mockResolvedValueOnce({ token: TOKEN, blocked: null });
    expect(await (await GET(request("GET"), params())).json()).toEqual({
      path: `/read/${TOKEN}`,
      blocked: null,
    });

    shares.getStatus.mockResolvedValueOnce({ token: null, blocked: SHARE_BLOCKED_REASON });
    expect(await (await GET(request("GET"), params())).json()).toEqual({
      path: null,
      blocked: SHARE_BLOCKED_REASON,
    });
  });

  it("creates a link as the signed-in user", async () => {
    shares.createLink.mockResolvedValue({ token: TOKEN, blocked: null });
    const response = await POST(request("POST"), params());
    expect(response.status).toBe(201);
    expect((await response.json()).path).toBe(`/read/${TOKEN}`);
    expect(shares.createLink).toHaveBeenCalledWith(
      COOKBOOK,
      "11111111-1111-4111-8111-111111111111"
    );
  });

  it("refuses with 409 when the cookbook holds published-book recipes", async () => {
    shares.createLink.mockRejectedValue(new ShareBlockedError());
    const response = await POST(request("POST"), params());
    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.detail).toBe(SHARE_BLOCKED_REASON);
    expect(body.code).toBe("share_blocked");
  });

  it("refuses with 403 and reports sharing off in the public demo", async () => {
    vi.stubEnv("OVENLOVIN_DEMO_MODE", "1");
    const response = await POST(request("POST"), params());
    expect(response.status).toBe(403);
    expect((await response.json()).detail).toBe("Share links are turned off in the public demo.");
    expect(shares.createLink).not.toHaveBeenCalled();

    shares.getStatus.mockResolvedValueOnce({ token: TOKEN, blocked: null });
    expect(await (await GET(request("GET"), params())).json()).toEqual({
      path: null,
      blocked: "Share links are turned off in the public demo.",
    });
  });

  it("revokes", async () => {
    expect((await DELETE(request("DELETE"), params())).status).toBe(204);
    expect(shares.revokeLink).toHaveBeenCalledWith(COOKBOOK);
  });
});
