import { describe, expect, it } from "vitest";
import { DEMO_COOKIE_NAME, DEMO_TTL_SECONDS } from "./fixture";
import { demoCookieOptions, isDemoCookieName, isSandboxExpired } from "./sandbox";

describe("demo sandbox cookie", () => {
  it("uses a stable cookie name and 24-hour max-age", () => {
    expect(isDemoCookieName(DEMO_COOKIE_NAME)).toBe(true);
    expect(demoCookieOptions(true)).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: DEMO_TTL_SECONDS,
    });
  });

  it("treats an equal timestamp as expired", () => {
    const now = new Date("2026-10-15T00:00:00.000Z");
    expect(isSandboxExpired(now, now)).toBe(true);
    expect(isSandboxExpired(new Date("2026-10-15T00:00:01.000Z"), now)).toBe(false);
  });
});
