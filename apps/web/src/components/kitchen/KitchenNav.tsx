"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isKitchenNavActive, kitchenMenuLinks } from "@/lib/kitchen-nav";
import { kitchenNavIcons } from "./KitchenNavIcons";

export function KitchenNav({ variant = "links" }: { variant?: "links" | "sidebar" }) {
  const pathname = usePathname();

  if (variant === "sidebar") {
    return (
      <nav className="kitchen-sidebar-nav" aria-label="Kitchen">
        <ul>
          {kitchenMenuLinks.map((link) => {
            const current = isKitchenNavActive(pathname, link.match);
            const Icon = kitchenNavIcons[link.label];
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
      {kitchenMenuLinks.map((link) => {
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
