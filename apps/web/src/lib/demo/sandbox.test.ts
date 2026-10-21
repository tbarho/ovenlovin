import { describe, expect, it } from "vitest";
import { DEMO_COOKIE_NAME, DEMO_TTL_SECONDS } from "./fixture";
import { getTableName } from "drizzle-orm";
import {
  DEMO_SANDBOX_IMPORT_TABLES,
  DEMO_SANDBOX_INVITE_TABLES,
  DEMO_SANDBOX_RECIPE_CHILD_TABLES,
  DEMO_SANDBOX_USER_REF_TABLES,
  demoCookieOptions,
  isDemoCookieName,
  isSandboxExpired,
  rehomeSandboxApiKeys,
  resetDemoSandbox,
  wipeExpiredDemoSandboxes,
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
    expect(DEMO_SANDBOX_IMPORT_TABLES).toEqual(["import_dedupe"]);
    expect(DEMO_SANDBOX_INVITE_TABLES).toEqual(["household_invite"]);
    expect(DEMO_SANDBOX_USER_REF_TABLES).toEqual(["membership", "person", "person_rule", "share"]);
  });

  it("wipes a sandbox that has leftover invite and import rows before the household", async () => {
    const deleted: string[] = [];
    const leftover = new Set(["import_dedupe", "household_invite"]);
    const thenable = <T>(value: T) => ({
      from() {
        return this;
      },
      innerJoin() {
        return this;
      },
      where() {
        return this;
      },
      limit() {
        return Promise.resolve(value);
      },
      then(onFulfilled: (value: T) => unknown, onRejected?: (reason: unknown) => unknown) {
        return Promise.resolve(value).then(onFulfilled, onRejected);
      },
    });
    const db = {
      select: (shape?: Record<string, unknown>) => {
        if (shape && "householdId" in shape && "userId" in shape) {
          return thenable([
            {
              id: "sandbox-1",
              householdId: "household-1",
              userId: "user-1",
            },
          ]);
        }
        return thenable([]);
      },
      update: () => ({
        set: () => ({
          where: async () => undefined,
        }),
      }),
      delete: (table: unknown) => ({
        where: async () => {
          const name = getTableName(table as never);
          if (name === "recipe" && leftover.has("import_dedupe")) {
            throw new Error(`FK import_dedupe still references ${name}`);
          }
          if (name === "household" && leftover.size > 0) {
            throw new Error(`FK ${[...leftover].join(",")} still references ${name}`);
          }
          leftover.delete(name);
          deleted.push(name);
        },
      }),
    } as unknown as DbClient;

    await wipeExpiredDemoSandboxes(db, new Date("2026-10-19T00:00:00.000Z"));
    expect(deleted).toContain("import_dedupe");
    expect(deleted).toContain("household_invite");
    expect(leftover.size).toBe(0);
    expect(deleted.indexOf("import_dedupe")).toBeLessThan(deleted.indexOf("recipe"));
    expect(deleted.indexOf("import_dedupe")).toBeLessThan(deleted.indexOf("household"));
    expect(deleted.indexOf("household_invite")).toBeLessThan(deleted.indexOf("household"));
  });

  it("lets an invitee reset after joining another kitchen without wiping that kitchen", async () => {
    const deleted: string[] = [];
    const leftoverUser = new Set(["membership", "person", "share"]);
    let householdGone = false;
    const thenable = <T>(value: T) => ({
      from() {
        return this;
      },
      innerJoin() {
        return this;
      },
      where() {
        return this;
      },
      limit() {
        return Promise.resolve(value);
      },
      then(onFulfilled: (value: T) => unknown, onRejected?: (reason: unknown) => unknown) {
        return Promise.resolve(value).then(onFulfilled, onRejected);
      },
    });
    const db = {
      select: (shape?: Record<string, unknown>) => {
        if (shape && "householdId" in shape && "userId" in shape) {
          return thenable([
            {
              id: "sandbox-b",
              householdId: "household-b",
              userId: "user-b",
            },
          ]);
        }
        return thenable([]);
      },
      update: (table: unknown) => ({
        set: () => ({
          where: async () => {
            leftoverUser.delete(getTableName(table as never));
          },
        }),
      }),
      delete: (table: unknown) => ({
        where: async () => {
          const name = getTableName(table as never);
          if (name === "household") {
            householdGone = true;
          }
          if (name === "membership" && householdGone) {
            leftoverUser.delete("membership");
          }
          if (name === "share" && householdGone) {
            leftoverUser.delete("share");
          }
          if (name === "user" && leftoverUser.size > 0) {
            throw new Error(`FK ${[...leftoverUser].join(",")} still references user`);
          }
          deleted.push(name);
        },
      }),
    } as unknown as DbClient;

    await wipeExpiredDemoSandboxes(db, new Date("2026-10-19T00:00:00.000Z"));
    expect(leftoverUser.size).toBe(0);
    expect(deleted).toContain("user");
    expect(deleted.filter((name) => name === "household")).toHaveLength(1);
    expect(deleted.indexOf("household")).toBeLessThan(deleted.lastIndexOf("membership"));
    expect(deleted.lastIndexOf("membership")).toBeLessThan(deleted.indexOf("user"));
  });

  it("skips deleting the sandbox user when another kitchen still has a rule they set", async () => {
    const deleted: string[] = [];
    let householdGone = false;
    const thenable = <T>(value: T) => ({
      from() {
        return this;
      },
      innerJoin() {
        return this;
      },
      where() {
        return this;
      },
      limit() {
        return Promise.resolve(value);
      },
      then(onFulfilled: (value: T) => unknown, onRejected?: (reason: unknown) => unknown) {
        return Promise.resolve(value).then(onFulfilled, onRejected);
      },
    });
    const db = {
      select: (shape?: Record<string, unknown>) => {
        if (shape && "householdId" in shape && "userId" in shape) {
          return thenable([
            {
              id: "sandbox-b",
              householdId: "household-b",
              userId: "user-b",
            },
          ]);
        }
        if (householdGone && shape && "id" in shape) {
          return thenable([{ id: "rule-1" }]);
        }
        return thenable([]);
      },
      update: () => ({
        set: () => ({
          where: async () => undefined,
        }),
      }),
      delete: (table: unknown) => ({
        where: async () => {
          const name = getTableName(table as never);
          if (name === "household") householdGone = true;
          deleted.push(name);
        },
      }),
    } as unknown as DbClient;

    await wipeExpiredDemoSandboxes(db, new Date("2026-10-19T00:00:00.000Z"));
    expect(deleted).not.toContain("user");
    expect(deleted.filter((name) => name === "household")).toHaveLength(1);
  });

  it("moves API keys to the new sandbox so reset does not 401 the old key", async () => {
    const moved: Array<{ householdId?: string }> = [];
    const db = {
      update: (table: unknown) => ({
        set: (values: { householdId?: string }) => ({
          where: async () => {
            expect(getTableName(table as never)).toBe("api_key");
            moved.push(values);
          },
        }),
      }),
    } as unknown as DbClient;

    await rehomeSandboxApiKeys(db, "household-old", "household-new");
    expect(moved).toEqual([{ householdId: "household-new", updatedAt: expect.any(Date) }]);
    await rehomeSandboxApiKeys(db, "household-same", "household-same");
    expect(moved).toHaveLength(1);
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
