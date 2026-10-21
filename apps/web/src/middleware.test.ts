import { NextRequest, NextResponse } from "next/server";
import { describe, expect, it, vi } from "vitest";

type AuthFn = () => Promise<{ userId: string | null }>;
type ClerkHandler = (auth: AuthFn, req: NextRequest) => Promise<unknown>;

let clerkHandler: ClerkHandler | undefined;

vi.mock("@clerk/nextjs/server", () => ({
  clerkMiddleware: (handler: ClerkHandler) => {
    clerkHandler = handler;
    return () => undefined;
  },
}));

vi.stubEnv("CLERK_SECRET_KEY", "sk_test");
vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "pk_test");

await import("./middleware");

describe("middleware", () => {
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
});
