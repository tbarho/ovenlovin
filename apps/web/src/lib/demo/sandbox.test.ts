import { describe, expect, it } from "vitest";
import { DEMO_COOKIE_NAME, DEMO_TTL_SECONDS } from "./fixture";
import {
  DEMO_SANDBOX_RECIPE_CHILD_TABLES,
  demoCookieOptions,
  isDemoCookieName,
  isSandboxExpired,
  resetDemoSandbox,
} from "./sandbox";
import type { DbClient } from "@ovenlovin/db";

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

  it("wipes every recipe child table so reset cannot leave ingredient-less cards", () => {
    expect(DEMO_SANDBOX_RECIPE_CHILD_TABLES).toEqual([
      "recipe_ingredient",
      "recipe_ingredient_group",
      "recipe_step",
      "recipe_source",
      "recipe_nutrition",
      "recipe_tag",
      "recipe_rating",
      "cook_log",
    ]);
  });

  it("reseeds inside a transaction so a failed seed leaves the old kitchen", async () => {
    const db = {
      transaction: async () => {
        throw new Error("reseed failed");
      },
    } as unknown as DbClient;

    await expect(resetDemoSandbox("sandbox-1", db)).rejects.toThrow("reseed failed");
  });
});
