"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { isKitchenNavActive, kitchenDocsLink, kitchenNavLinks } from "@/lib/kitchen-nav";
import { KitchenSwitcher } from "@/components/settings/KitchenSwitcher";
import { BottomSheet } from "./BottomSheet";
import { DocsIcon, MenuIcon, kitchenNavIcons } from "./KitchenNavIcons";

export function KitchenMenu({ children }: { children?: ReactNode }) {
  const pathname = usePathname();
  const dialogId = useId();
  const [open, setOpen] = useState(false);
  const pathRef = useRef(pathname);

  useEffect(() => {
    if (pathRef.current === pathname) return;
    pathRef.current = pathname;
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 860px)");
    function onChange() {
      if (!media.matches) setOpen(false);
    }
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  function close() {
    setOpen(false);
  }

  return (
    <div className="kitchen-menu">
      <button
        type="button"
        className="kitchen-menu-trigger"
        aria-label="Open kitchen menu"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={dialogId}
        onClick={() => setOpen(true)}
      >
        <MenuIcon />
      </button>
      <BottomSheet
        id={dialogId}
        className="kitchen-menu-sheet"
        open={open}
        title="Menu"
        onClose={close}
        swipeToDismiss
      >
        <nav className="kitchen-menu-nav" aria-label="Kitchen">
          <ul>
            {kitchenNavLinks.map((link) => {
              const current = isKitchenNavActive(pathname, link.match);
              const Icon = kitchenNavIcons[link.label];
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={current ? "page" : undefined}
                    onClick={current ? close : undefined}
                  >
                    <Icon />
                    <span>{link.label}</span>
                  </Link>
                </li>
              );
            })}
            <li>
              <Link
                href={kitchenDocsLink.href}
                aria-current={
                  isKitchenNavActive(pathname, kitchenDocsLink.match) ? "page" : undefined
                }
              >
                <DocsIcon />
                <span>{kitchenDocsLink.label}</span>
              </Link>
            </li>
          </ul>
        </nav>
        <KitchenSwitcher />
        {children ? <div className="kitchen-menu-account">{children}</div> : null}
      </BottomSheet>
    </div>
  );
}
