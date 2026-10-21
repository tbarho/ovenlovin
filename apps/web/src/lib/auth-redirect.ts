import { readInviteToken } from "@/lib/kitchen-cookies";
import { isKitchenNavActive, kitchenNavLinks } from "@/lib/kitchen-nav";

function sameOriginPath(raw: string, origins: string[]): string {
  if (!/^https?:\/\//i.test(raw)) return raw;
  try {
    const url = new URL(raw);
    const allowed = origins.some((origin) => new URL(origin).origin === url.origin);
    return allowed ? `${url.pathname}${url.search}` : raw;
  } catch {
    return raw;
  }
}

export function safeAuthRedirect(url: string | null | undefined, origins: string[] = []): string {
  if (!url) return "/recipes";
  const raw = sameOriginPath(url, origins);
  if (!raw.startsWith("/")) return "/recipes";
  if (raw.startsWith("//") || raw.includes("://") || raw.includes("\\")) return "/recipes";
  if (raw.startsWith("/api") || raw.startsWith("/mcp")) return "/recipes";
  if (raw.startsWith("/invite/")) {
    const token = raw.slice("/invite/".length).split(/[/?#]/)[0] ?? "";
    return readInviteToken(token) ? `/invite/${token}` : "/recipes";
  }
  const path = raw.split(/[?#]/)[0] ?? "";
  if (kitchenNavLinks.some((link) => isKitchenNavActive(path, link.match))) return raw;
  return "/recipes";
}
