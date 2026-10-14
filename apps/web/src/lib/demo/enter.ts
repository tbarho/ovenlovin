/**
 * First-visit helpers for the public demo.
 *
 * Sandbox cookies must be written from a Route Handler (Next 15 forbids
 * `cookies().set` during Server Component render). Middleware sends uncookied
 * kitchen pages to `/api/demo/enter`, which seeds and Set-Cookies.
 */

export const DEMO_ENTER_PATH = "/api/demo/enter";

export function safeDemoEnterNext(raw: string | null | undefined): string {
  if (!raw) return "/recipes";
  if (!raw.startsWith("/")) return "/recipes";
  if (raw.startsWith("//") || raw.includes("://")) return "/recipes";
  if (raw.startsWith("/api") || raw.startsWith("/mcp")) return "/recipes";
  return raw;
}

export function shouldRedirectToDemoEnter(pathname: string, cookieId: string | undefined): boolean {
  if (cookieId) return false;
  if (pathname.startsWith("/api") || pathname === "/mcp" || pathname.startsWith("/mcp/")) {
    return false;
  }
  if (pathname.startsWith("/_next") || pathname.startsWith("/demo-kitchen")) {
    return false;
  }
  return true;
}

export function wantsDemoEnterJson(input: {
  accept: string | null;
  format: string | null;
  secFetchDest: string | null;
}): boolean {
  if (input.format === "json") return true;
  if (input.secFetchDest === "document") return false;
  const accept = input.accept ?? "";
  return accept.includes("application/json") && !accept.includes("text/html");
}
