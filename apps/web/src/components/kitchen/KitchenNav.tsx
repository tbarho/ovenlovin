"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { isKitchenNavActive, kitchenNavLinks } from "@/lib/kitchen-nav";
import { ListIcon, PeopleIcon, PlanIcon, RecipesIcon, SettingsIcon } from "./KitchenNavIcons";

const tabIcons = {
  Recipes: RecipesIcon,
  Plan: PlanIcon,
  List: ListIcon,
  People: PeopleIcon,
  Settings: SettingsIcon,
} as const;

export function KitchenNav({ variant = "links" }: { variant?: "links" | "tabs" | "sidebar" }) {
  const pathname = usePathname();
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  function onNavigate(href: string) {
    if (!isKitchenNavActive(pathname, href)) setPendingHref(href);
  }

  if (variant === "tabs") {
    return (
      <nav className="kitchen-tabbar" aria-label="Kitchen" aria-busy={Boolean(pendingHref)}>
        {pendingHref ? (
          <p className="kitchen-tabbar-pending" role="status">
            Loading…
          </p>
        ) : null}
        <ul>
          {kitchenNavLinks.map((link) => {
            const current = isKitchenNavActive(pathname, link.match);
            const Icon = tabIcons[link.label];
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={current ? "page" : undefined}
                  aria-busy={pendingHref === link.href || undefined}
                  onClick={() => onNavigate(link.href)}
                >
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
                <Link
                  href={link.href}
                  aria-current={current ? "page" : undefined}
                  onClick={() => onNavigate(link.href)}
                >
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
