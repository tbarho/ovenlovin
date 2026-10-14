import { beforeEach, describe, expect, it, vi } from "vitest";
import { UnauthorizedError } from "@/lib/api/errors";

const cookiesGet = vi.fn();
const redirect = vi.fn(() => {
  throw new Error("redirected");
});

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: cookiesGet }),
}));

vi.mock("next/navigation", () => ({
  redirect,
}));

vi.mock("./sandbox", () => ({
  findDemoSandboxById: vi.fn(),
  sandboxToSession: vi.fn(),
}));

describe("getDemoSessionContext", () => {
  beforeEach(() => {
    cookiesGet.mockReset();
    redirect.mockClear();
  });

  it("throws UnauthorizedError for API callers when the demo cookie is missing", async () => {
    cookiesGet.mockReturnValue(undefined);
    const { getDemoSessionContext } = await import("./session");
    await expect(getDemoSessionContext({ allowRedirect: false })).rejects.toBeInstanceOf(
      UnauthorizedError
    );
    expect(redirect).not.toHaveBeenCalled();
  });

  it("still redirects HTML visitors when the demo cookie is missing", async () => {
    cookiesGet.mockReturnValue(undefined);
    const { getDemoSessionContext } = await import("./session");
    await expect(getDemoSessionContext()).rejects.toThrow(/redirected/);
    expect(redirect).toHaveBeenCalled();
  });
});
