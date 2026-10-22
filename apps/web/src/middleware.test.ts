import { NextRequest, NextResponse } from "next/server";
import { describe, expect, it, vi } from "vitest";

type AuthFn = () => Promise<{ userId: string | null }>;
type ClerkHandler = (auth: AuthFn, req: NextRequest) => Promise<unknown>;

let clerkHandler: ClerkHandler | undefined;
let clerkOptions: unknown;

vi.mock("@clerk/nextjs/server", () => ({
  clerkMiddleware: (handler: ClerkHandler, options?: unknown) => {
    clerkHandler = handler;
    clerkOptions = options;
    return () => undefined;
  },
}));

vi.stubEnv("CLERK_SECRET_KEY", "sk_test");
vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "pk_test");
vi.stubEnv("NEXT_PUBLIC_CLERK_SIGN_IN_URL", "");
vi.stubEnv("NEXT_PUBLIC_CLERK_SIGN_UP_URL", "");

await import("./middleware");

describe("middleware", () => {
  it("points Clerk at the in-app sign-in and sign-up pages", () => {
    expect(clerkOptions).toEqual({ signInUrl: "/sign-in", signUpUrl: "/sign-up" });
  });

  it("sends signed-out /settings to sign-in and back", async () => {
    const req = new NextRequest("http://localhost/settings");
    const result = await clerkHandler!(async () => ({ userId: null }), req);
    expect(result).toBeInstanceOf(NextResponse);
    const location = (result as NextResponse).headers.get("location") ?? "";
    expect(location).toContain("/sign-in");
    expect(location).toContain("redirect_url=%2Fsettings");
  });

  it("lets a signed-in user through /settings", async () => {
    const req = new NextRequest("http://localhost/settings");
    const result = await clerkHandler!(async () => ({ userId: "user_1" }), req);
    expect(result).toBeUndefined();
  });

  it("does not send an unknown public path to Clerk", async () => {
    const protect = vi.fn();
    const auth = Object.assign(
      vi.fn(async () => ({ userId: null })),
      { protect }
    );
    const result = await clerkHandler!(auth, new NextRequest("http://localhost/nope"));
    expect(result).toBeUndefined();
    expect(auth).not.toHaveBeenCalled();
    expect(protect).not.toHaveBeenCalled();
  });
});
