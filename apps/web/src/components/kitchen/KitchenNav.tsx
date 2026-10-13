"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isKitchenNavActive, kitchenNavLinks } from "@/lib/kitchen-nav";

export function KitchenNav() {
  const pathname = usePathname();

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
