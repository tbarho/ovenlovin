import { describe, expect, it, vi } from "vitest";

vi.mock("@ovenlovin/db", () => ({ getDatabase: () => ({}) }));

import {
  bookFingerprint,
  printCookbookId,
  printMode,
  printSigningSecret,
  printToken,
  readPrintToken,
} from "./book-print";

const BOOK = "00000000-0000-4000-8000-000000000020";
const HOUSEHOLD = "22222222-2222-4222-8222-222222222222";
const env = { CRON_SECRET: "shh", NODE_ENV: "production" };

describe("print token", () => {
  it("grants the household for the cookbook it was signed for", () => {
    const token = printToken(BOOK, HOUSEHOLD, 1_000, env);
    expect(readPrintToken(token, BOOK, 2_000, env)).toBe(HOUSEHOLD);
  });

  it("refuses another cookbook, an expired pass, or a forged mac", () => {
    const token = printToken(BOOK, HOUSEHOLD, 1_000, env);
    expect(readPrintToken(token, "00000000-0000-4000-8000-000000000099", 2_000, env)).toBeNull();
    expect(readPrintToken(token, BOOK, 1_000 + 11 * 60 * 1000, env)).toBeNull();
    expect(readPrintToken(`${token.slice(0, -4)}beef`, BOOK, 2_000, env)).toBeNull();
    expect(readPrintToken(token, BOOK, 2_000, { ...env, CRON_SECRET: "other" })).toBeNull();
    expect(readPrintToken(undefined, BOOK, 2_000, env)).toBeNull();
  });

  it("will not sign in production without a secret", () => {
    expect(printSigningSecret({ NODE_ENV: "production" })).toBeNull();
    expect(printSigningSecret({ VERCEL_ENV: "production", NODE_ENV: "production" })).toBeNull();
    expect(() => printToken(BOOK, HOUSEHOLD, 1_000, { NODE_ENV: "production" })).toThrow(
      /CRON_SECRET is required/
    );
    expect(() =>
      printToken(BOOK, HOUSEHOLD, 1_000, { VERCEL_ENV: "production", NODE_ENV: "production" })
    ).toThrow(/CRON_SECRET is required/);
  });

  it("mints on Vercel preview without CRON_SECRET", () => {
    const preview = { VERCEL_ENV: "preview", NODE_ENV: "production" };
    expect(printSigningSecret(preview)).toBe("ovenlovin-dev-print");
    const token = printToken(BOOK, HOUSEHOLD, 1_000, preview);
    expect(readPrintToken(token, BOOK, 2_000, preview)).toBe(HOUSEHOLD);
  });

  it("signs with CRON_SECRET on production", () => {
    expect(printSigningSecret(env)).toBe("shh");
    const token = printToken(BOOK, HOUSEHOLD, 1_000, env);
    expect(readPrintToken(token, BOOK, 2_000, env)).toBe(HOUSEHOLD);
  });
});

describe("bookFingerprint", () => {
  const pages = [{ number: 1, kind: "cover", title: "A" }];

  it("is stable for the same pages and mode", () => {
    expect(bookFingerprint(BOOK, "home", pages)).toBe(bookFingerprint(BOOK, "home", pages));
  });

  it("changes with the mode or the pages", () => {
    const home = bookFingerprint(BOOK, "home", pages);
    expect(bookFingerprint(BOOK, "shop", pages)).not.toBe(home);
    expect(bookFingerprint(BOOK, "home", [{ ...pages[0], title: "B" }])).not.toBe(home);
  });
});

describe("printMode / printCookbookId", () => {
  it("defaults unknown modes to home", () => {
    expect(printMode("shop")).toBe("shop");
    expect(printMode("glossy")).toBe("home");
  });

  it("only takes uuids outside the e2e bypass", () => {
    expect(printCookbookId(BOOK)).toBe(BOOK);
    expect(() => printCookbookId("e2e-print-300", { NODE_ENV: "development" })).toThrow();
    expect(() => printCookbookId("x")).toThrow();
    expect(printCookbookId("e2e-print-300", { NODE_ENV: "test" })).toBe("e2e-print-300");
  });
});
