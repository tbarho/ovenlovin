export const kitchenNavLinks = [
  { href: "/recipes", label: "Recipes", match: "/recipes" },
  { href: "/people", label: "People", match: "/people" },
  { href: "/#connect", label: "Agents", match: null },
  { href: "/settings", label: "Settings", match: "/settings" },
] as const;

export function isKitchenNavActive(pathname: string, match: string | null): boolean {
  if (!match) return false;
  return pathname === match || pathname.startsWith(`${match}/`);
}
