import { readInviteToken } from "@/lib/kitchen-cookies";
import { isKitchenNavActive, kitchenNavLinks } from "@/lib/kitchen-nav";

export function safeAuthRedirect(raw: string | null | undefined): string {
  if (!raw) return "/recipes";
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
