"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";

export function overflowsX(node: Pick<HTMLElement, "scrollWidth" | "clientWidth">) {
  return node.scrollWidth > node.clientWidth + 1;
}

export function OverflowX({ className, children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const host = ref.current;
    if (!host) return;
    const scroll = host.querySelector<HTMLElement>("[data-scroll]") ?? host;
    const sync = () => host.toggleAttribute("data-overflow", overflowsX(scroll));
    sync();
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(sync);
    ro?.observe(host);
    if (scroll !== host) ro?.observe(scroll);
    scroll.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync);
    return () => {
      ro?.disconnect();
      scroll.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
    };
  }, []);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
