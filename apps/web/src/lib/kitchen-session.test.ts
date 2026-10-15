import { beforeEach, describe, expect, it, vi } from "vitest";
import { UnauthorizedError } from "@/lib/api/errors";

const getSessionContext = vi.fn();
const isDemoModeEnabled = vi.fn(() => false);
const redirect = vi.fn((href: string) => {
  throw new Error(`redirect:${href}`);
});

vi.mock("./session", () => ({
  getSessionContext: (...args: unknown[]) => getSessionContext(...args),
}));

vi.mock("./demo/mode", () => ({
  isDemoModeEnabled: () => isDemoModeEnabled(),
}));

vi.mock("next/navigation", () => ({
  redirect: (href: string) => redirect(href),
  unstable_rethrow: (error: unknown) => {
    if (error instanceof Error && error.message.startsWith("redirect:")) {
      throw error;
    }
  },
}));

describe("requireKitchenContext", () => {
  beforeEach(() => {
    getSessionContext.mockReset();
    isDemoModeEnabled.mockReturnValue(false);
    redirect.mockClear();
  });

  it("returns a live session", async () => {
    const session = { householdId: "hh-1", userId: "user-1" };
    getSessionContext.mockResolvedValue(session);
    const { requireKitchenContext } = await import("./kitchen-session");
    await expect(requireKitchenContext()).resolves.toEqual(session);
    expect(redirect).not.toHaveBeenCalled();
  });

  it("does not swallow a demo enter redirect into /sign-in", async () => {
    isDemoModeEnabled.mockReturnValue(true);
    getSessionContext.mockImplementation(() => {
      redirect("/api/demo/enter?next=%2Frecipes");
    });
    const { requireKitchenContext } = await import("./kitchen-session");
    await expect(requireKitchenContext()).rejects.toThrow(/redirect:\/api\/demo\/enter/);
    expect(redirect).toHaveBeenCalledWith("/api/demo/enter?next=%2Frecipes");
    expect(redirect).not.toHaveBeenCalledWith("/sign-in");
  });

  it("sends a missing demo session to enter, not sign-in", async () => {
    isDemoModeEnabled.mockReturnValue(true);
    getSessionContext.mockRejectedValue(new UnauthorizedError("Authentication required"));
    const { requireKitchenContext } = await import("./kitchen-session");
    await expect(requireKitchenContext()).rejects.toThrow(/redirect:\/api\/demo\/enter/);
  });

  it("sends a missing Clerk session to sign-in", async () => {
    getSessionContext.mockRejectedValue(new UnauthorizedError("Authentication required"));
    const { requireKitchenContext } = await import("./kitchen-session");
    await expect(requireKitchenContext()).rejects.toThrow(/redirect:\/sign-in/);
  });
});
