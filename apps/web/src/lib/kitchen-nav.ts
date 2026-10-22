export const kitchenNavLinks = [
  { href: "/recipes", label: "Recipes", match: "/recipes" },
  { href: "/plans", label: "Plan", match: "/plans" },
  { href: "/list", label: "List", match: "/list" },
  { href: "/people", label: "People", match: "/people" },
  { href: "/settings", label: "Settings", match: "/settings" },
] as const;

/** Public in-app docs. Not in kitchenNavLinks so Clerk does not protect /docs. */
export const kitchenDocsLink = { href: "/docs", label: "Docs", match: "/docs" } as const;

export const kitchenMenuLinks = [...kitchenNavLinks, kitchenDocsLink] as const;

export function isKitchenNavActive(pathname: string, match: string | null): boolean {
  if (!match) return false;
  return pathname === match || pathname.startsWith(`${match}/`);
}

export function kitchenPageTitle(pathname: string): string {
  const current = kitchenNavLinks.find((link) => isKitchenNavActive(pathname, link.match));
  return current?.label ?? "Kitchen";
}
