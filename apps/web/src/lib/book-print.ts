import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { paginate, PRINT_MODES, type PrintMode } from "@ovenlovin/core/book";
import { z } from "zod";
import { NotFoundError } from "@/lib/api/errors";
import { loadReaderBook, type ReaderBook } from "@/lib/book-reader";
import { isE2eAuthBypassEnabled } from "@/lib/e2e-auth";
import { PRINT_FIXTURE_ID, printFixtureCookbook } from "@/test/print-fixture";

type EnvLike = Record<string, string | undefined>;

/** CSS px per inch. The print route lays pages out at 96 px/in. */
export const PX = 96;

export const PRINT_TOKEN_MS = 10 * 60 * 1000;

export function printMode(value: unknown): PrintMode {
  return PRINT_MODES.includes(value as PrintMode) ? (value as PrintMode) : "home";
}

function secret(env: EnvLike) {
  const value = env.CRON_SECRET?.trim();
  if (value) return value;
  if (env.NODE_ENV === "production") return null;
  return "ovenlovin-dev-print";
}

const sign = (key: string, body: string) => createHmac("sha256", key).update(body).digest("hex");

/**
 * Short-lived pass for the PDF renderer: headless Chromium has no session, so
 * the worker signs which cookbook (and household) it may open, and for how long.
 */
export function printToken(
  cookbookId: string,
  householdId: string,
  now = Date.now(),
  env: EnvLike = process.env
) {
  const key = secret(env);
  if (!key) throw new Error("CRON_SECRET is required to print books");
  const body = `${cookbookId}.${householdId}.${now + PRINT_TOKEN_MS}`;
  return `${body}.${sign(key, body)}`;
}

/** The household a token grants for this cookbook, or null. */
export function readPrintToken(
  token: unknown,
  cookbookId: string,
  now = Date.now(),
  env: EnvLike = process.env
) {
  const key = secret(env);
  if (!key || typeof token !== "string") return null;
  const [id, householdId, expires, mac] = token.split(".");
  if (!id || !householdId || !expires || !mac || id !== cookbookId) return null;
  if (Number(expires) < now) return null;
  const want = Buffer.from(sign(key, `${id}.${householdId}.${expires}`));
  const got = Buffer.from(mac);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  return householdId;
}

/** A cookbook uuid, or the print fixture under the e2e bypass. Anything else 404s. */
export function printCookbookId(id: string, env: EnvLike = process.env) {
  if (id === PRINT_FIXTURE_ID && isE2eAuthBypassEnabled(env)) return id;
  if (z.string().uuid().safeParse(id).success) return id;
  throw new NotFoundError("Cookbook", id);
}

/** Same pages and mode in, same fingerprint out. A changed book prints fresh. */
export function bookFingerprint(cookbookId: string, mode: PrintMode, pages: any[]) {
  return createHash("sha256").update(JSON.stringify({ cookbookId, mode, pages })).digest("hex");
}

/** The cookbook as the print route lays it out. The 300-recipe fixture exists only under the e2e bypass. */
export async function loadPrintBook(
  cookbookId: string,
  householdId: string
): Promise<ReaderBook | null> {
  if (cookbookId === PRINT_FIXTURE_ID) {
    if (!isE2eAuthBypassEnabled()) return null;
    const cookbook = printFixtureCookbook();
    return { id: cookbookId, title: cookbook.name, subtitle: null, pages: paginate(cookbook) };
  }
  return loadReaderBook(cookbookId, householdId);
}
