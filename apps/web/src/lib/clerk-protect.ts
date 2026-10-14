/**
 * Paths Clerk middleware must not `auth.protect()`.
 *
 * REST `/api/v1/*` authenticates itself (Clerk session *or* API key) and
 * returns problem+json 401/403. Calling `auth.protect()` first turns a missing
 * session into Clerk's HTML 404, which breaks every bot client.
 */
export function isClerkProtectExempt(pathname: string): boolean {
  if (pathname === "/") return true;

  const prefixes = [
    "/sign-in",
    "/sign-up",
    "/api/v1",
    "/api/cron",
    "/api/demo",
    "/mcp",
    "/docs",
    "/llms.txt",
    "/brand",
    "/prototype",
    "/dev/people-preview",
  ];

  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
