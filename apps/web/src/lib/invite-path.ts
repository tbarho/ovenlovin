import { readInviteToken } from "@/lib/kitchen-cookies";

export function inviteTokenFromPathname(pathname: string): string | null {
  if (!pathname.startsWith("/invite/")) return null;
  const token = pathname.slice("/invite/".length).split(/[/?#]/)[0] ?? "";
  return readInviteToken(token);
}
