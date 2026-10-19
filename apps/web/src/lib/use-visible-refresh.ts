"use client";

import { useEffect } from "react";

export function useVisibleRefresh(load: () => Promise<unknown>, ms = 5000) {
  useEffect(() => {
    function refresh() {
      if (document.visibilityState === "hidden") return;
      void load();
    }

    const id = window.setInterval(refresh, ms);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [load, ms]);
}
