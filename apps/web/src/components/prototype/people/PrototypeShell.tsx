"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { brandPublicPath } from "@ovenlovin/brand";
import type { ReactNode } from "react";
import { usePrototype } from "./store";
import { Toast } from "./ui";

const TABS = [
  { href: "/prototype/people", label: "Household", icon: "🏠", match: "home" },
  { href: "/prototype/people/setup", label: "Setup", icon: "✨", match: "setup" },
  { href: "/prototype/people/recipe", label: "Recipes", icon: "🍝", match: "recipe" },
] as const;

function tabActive(pathname: string, match: (typeof TABS)[number]["match"]): boolean {
  if (match === "setup") return pathname.startsWith("/prototype/people/setup");
  if (match === "recipe") return pathname.startsWith("/prototype/people/recipe");
  if (pathname === "/prototype/people") return true;
  if (
    pathname.startsWith("/prototype/people/") &&
    !pathname.includes("/setup") &&
    !pathname.includes("/recipe")
  ) {
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
              <span aria-hidden="true">{tab.icon}</span>
              {tab.label}
            </Link>
          ))}
        </nav>
        <PrototypeJump resetDemo={resetDemo} />
      </aside>

      <div className="olp-main">
        <header className="olp-top">
          <Link href="/prototype/people" className="olp-brand olp-brand-mobile">
            <Image src={brandPublicPath.mark} alt="" width={30} height={30} unoptimized />
            <span className="olp-wordmark">OvenLovin</span>
          </Link>
          <span className="olp-proto-pill">UX prototype · mock data</span>
        </header>
        <div className="olp-jump-mobile">
          <PrototypeJump resetDemo={resetDemo} compact />
        </div>
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
            <span aria-hidden="true">{tab.icon}</span>
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

function PrototypeJump({ resetDemo, compact }: { resetDemo: () => void; compact?: boolean }) {
  return (
    <div className={`olp-jump${compact ? " is-compact" : ""}`}>
      {!compact ? <p className="olp-kicker">Jump the flows</p> : null}
      <div className="olp-jump-links">
        <Link href="/prototype/people/setup">Wizard</Link>
        <Link href="/prototype/people">Household</Link>
        <Link href="/prototype/people/jake">Jake</Link>
        <Link href="/prototype/people/recipe">Recipe</Link>
        <button type="button" onClick={resetDemo}>
          Reset demo
        </button>
      </div>
    </div>
  );
}
