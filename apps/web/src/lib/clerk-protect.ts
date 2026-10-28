import { kitchenNavLinks } from "./kitchen-nav";

/**
 * Kitchen pages only. Unknown public URLs must 404 in-app, not bounce to Clerk.
 * `/cookbooks` holds only the book reader, which needs the kitchen session.
 */
export function isClerkProtectedPath(pathname: string): boolean {
  const prefixes = [...kitchenNavLinks.map((link) => link.match), "/cookbooks"];
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

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
    "/invite",
    "/print",
    "/api/v1",
    "/api/cron",
    "/api/demo",
    "/mcp",
    "/docs",
    "/changelog",
    "/llms.txt",
    "/robots.txt",
    "/sitemap.xml",
    "/manifest.webmanifest",
    "/brand",
    "/prototype",
    "/dev/people-preview",
  ];

  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
