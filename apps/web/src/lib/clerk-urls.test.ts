import { afterEach, describe, expect, it, vi } from "vitest";
import { clerkUrls } from "./clerk-urls";

describe("clerkUrls", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("defaults to the in-app sign-in and sign-up pages", () => {
    vi.stubEnv("NEXT_PUBLIC_CLERK_SIGN_IN_URL", "");
    vi.stubEnv("NEXT_PUBLIC_CLERK_SIGN_UP_URL", "");
    expect(clerkUrls()).toEqual({ signInUrl: "/sign-in", signUpUrl: "/sign-up" });
  });

  it("honors env overrides", () => {
    vi.stubEnv("NEXT_PUBLIC_CLERK_SIGN_IN_URL", "/login");
    vi.stubEnv("NEXT_PUBLIC_CLERK_SIGN_UP_URL", "/join");
    expect(clerkUrls()).toEqual({ signInUrl: "/login", signUpUrl: "/join" });
  });
});
