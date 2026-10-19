"use client";

import { useEffect } from "react";

export function useVisibleRefresh(load: () => Promise<unknown>, ms = 5000) {
  useEffect(() => {
    function refresh() {
      if (document.visibilityState === "hidden") return;
      void load().catch(() => {});
    }

    const id = window.setInterval(refresh, ms);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [load, ms]);
}
