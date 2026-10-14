"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isKitchenNavActive, kitchenNavLinks } from "@/lib/kitchen-nav";
import { AgentsIcon, PeopleIcon, RecipesIcon, SettingsIcon } from "./KitchenNavIcons";

const tabIcons = {
  Recipes: RecipesIcon,
  People: PeopleIcon,
  Agents: AgentsIcon,
  Settings: SettingsIcon,
} as const;

export function KitchenNav({ variant = "links" }: { variant?: "links" | "tabs" | "sidebar" }) {
  const pathname = usePathname();

  if (variant === "tabs") {
    return (
      <nav className="kitchen-tabbar" aria-label="Kitchen">
        <ul>
          {kitchenNavLinks.map((link) => {
            const current = isKitchenNavActive(pathname, link.match);
            const Icon = tabIcons[link.label];
            return (
              <li key={link.href}>
                <Link href={link.href} aria-current={current ? "page" : undefined}>
                  <Icon />
                  <span>{link.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    );
  }

  if (variant === "sidebar") {
    return (
      <nav className="kitchen-sidebar-nav" aria-label="Kitchen">
        <ul>
          {kitchenNavLinks.map((link) => {
            const current = isKitchenNavActive(pathname, link.match);
            const Icon = tabIcons[link.label];
            return (
              <li key={link.href}>
                <Link href={link.href} aria-current={current ? "page" : undefined}>
                  <Icon />
                  <span>{link.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    );
  }

  return (
    <ul className="nav-links kitchen-nav">
      {kitchenNavLinks.map((link) => {
        const current = isKitchenNavActive(pathname, link.match);
        return (
          <li key={link.href}>
            <Link href={link.href} aria-current={current ? "page" : undefined}>
              {link.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
