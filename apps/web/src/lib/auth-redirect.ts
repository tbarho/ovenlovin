import { readInviteToken } from "@/lib/kitchen-cookies";
import { isKitchenNavActive, kitchenNavLinks } from "@/lib/kitchen-nav";

function hasDotSegment(path: string): boolean {
  let decoded = path;
  for (let i = 0; i < 2; i++) {
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    } catch {
      break;
    }
  }
  return decoded.split("/").some((part) => {
    const segment = part.replace(/[\t\n\r]/g, "");
    return segment === "." || segment === "..";
  });
}

export function safeAuthRedirect(raw: string | null | undefined): string {
  if (!raw) return "/recipes";
  if (!raw.startsWith("/")) return "/recipes";
  if (raw.startsWith("//") || raw.includes("://") || raw.includes("\\")) return "/recipes";
  if (raw.startsWith("/api") || raw.startsWith("/mcp")) return "/recipes";
  const path = raw.split(/[?#]/)[0] ?? "";
  if (hasDotSegment(path)) return "/recipes";
  if (raw.startsWith("/invite/")) {
    const token = raw.slice("/invite/".length).split(/[/?#]/)[0] ?? "";
    return readInviteToken(token) ? `/invite/${token}` : "/recipes";
  }
  if (kitchenNavLinks.some((link) => isKitchenNavActive(path, link.match))) return raw;
  return "/recipes";
}
