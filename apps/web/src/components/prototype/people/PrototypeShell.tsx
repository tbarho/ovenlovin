"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { brandPublicPath } from "@ovenlovin/brand";
import type { ReactNode } from "react";
import { NavIcon } from "./icons";
import { usePrototype } from "./store";
import { Toast } from "./ui";

const TABS = [
  { href: "/prototype/people", label: "People", icon: "home" as const, match: "home" },
  { href: "/prototype/people/recipe", label: "Recipes", icon: "recipe" as const, match: "recipe" },
] as const;

function tabActive(pathname: string, match: (typeof TABS)[number]["match"]): boolean {
  if (match === "recipe") return pathname.startsWith("/prototype/people/recipe");
  if (pathname === "/prototype/people") return true;
  if (pathname.startsWith("/prototype/people/") && !pathname.includes("/recipe")) {
    return true;
  }
  return false;
}

export function PrototypeShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { toast, undoRemove, dismissToast, resetDemo } = usePrototype();

  return (
    <div className="olp">
      <aside className="olp-rail">
        <Link href="/prototype/people" className="olp-brand">
          <Image src={brandPublicPath.mark} alt="" width={36} height={36} unoptimized />
          <span className="olp-wordmark">OvenLovin</span>
        </Link>
        <nav className="olp-rail-nav" aria-label="Prototype">
          {TABS.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={tabActive(pathname, tab.match) ? "is-on" : undefined}
              aria-current={tabActive(pathname, tab.match) ? "page" : undefined}
            >
              <NavIcon name={tab.icon} />
              {tab.label}
            </Link>
          ))}
        </nav>
        <button type="button" className="olp-text-btn" onClick={resetDemo}>
          Reset demo
        </button>
      </aside>

      <div className="olp-main">
        <header className="olp-top">
          <Link href="/prototype/people" className="olp-brand olp-brand-mobile">
            <Image src={brandPublicPath.mark} alt="" width={30} height={30} unoptimized />
            <span className="olp-wordmark">OvenLovin</span>
          </Link>
          <span className="olp-proto-pill">Prototype · mock data</span>
          <button type="button" className="olp-text-btn olp-reset-mobile" onClick={resetDemo}>
            Reset demo
          </button>
        </header>
        <main className="olp-content">{children}</main>
      </div>

      <nav className="olp-tabbar" aria-label="Prototype">
        {TABS.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={tabActive(pathname, tab.match) ? "is-on" : undefined}
            aria-current={tabActive(pathname, tab.match) ? "page" : undefined}
          >
            <NavIcon name={tab.icon} />
            {tab.label}
          </Link>
        ))}
      </nav>

      <Toast
        message={toast?.message ?? null}
        onUndo={toast ? undoRemove : undefined}
        onDismiss={dismissToast}
      />
    </div>
  );
}
