"use client";

import { useEffect, useState } from "react";
import { VERCEL_DEPLOY_URL } from "@ovenlovin/brand";

const STORAGE_KEY = "ovenlovin.demo-banner.dismissed";

export function DemoBanner() {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (window.sessionStorage.getItem(STORAGE_KEY) === "1") setHidden(true);
  }, []);

  if (hidden) return null;

  return (
    <div className="demo-banner" role="status">
      <span>
        <strong>Demo, resets daily</strong>
        <span className="demo-banner-copy"> Your sandbox lasts about 24 hours.</span>
      </span>
      <div className="demo-banner-actions">
        <a className="btn primary demo-banner-cta" href={VERCEL_DEPLOY_URL}>
          Deploy your own
        </a>
        <button
          type="button"
          className="demo-banner-dismiss"
          onClick={() => {
            window.sessionStorage.setItem(STORAGE_KEY, "1");
            setHidden(true);
          }}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
