/**
 * First-visit helpers for the public demo.
 *
 * Sandbox cookies must be written from a Route Handler (Next 15 forbids
 * `cookies().set` during Server Component render). Middleware sends uncookied
 * kitchen pages to `/api/demo/enter`, which seeds and Set-Cookies.
 */

import { safeAuthRedirect } from "@/lib/auth-redirect";

export const DEMO_ENTER_PATH = "/api/demo/enter";

export function safeDemoEnterNext(raw: string | null | undefined): string {
  return safeAuthRedirect(raw);
}

const PUBLIC_PREFIXES = [
  "/api",
  "/mcp",
  "/docs",
  "/brand",
  "/sign-in",
  "/sign-up",
  "/invite",
  "/_next",
  "/demo-kitchen",
  "/prototype",
];

export function shouldRedirectToDemoEnter(pathname: string, cookieId: string | undefined): boolean {
  if (cookieId) return false;
  if (pathname === "/llms.txt") return false;
  return !PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function wantsDemoEnterJson(input: {
  accept: string | null;
  format: string | null;
  secFetchDest: string | null;
}): boolean {
  return input.format === "json";
}
