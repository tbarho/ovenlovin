import { VERCEL_DEPLOY_URL } from "@ovenlovin/brand";

export function DemoBanner() {
  return (
    <div className="demo-banner" role="status">
      <span>
        <strong>Demo, resets daily</strong>
        <span className="demo-banner-copy"> Your sandbox lasts about 24 hours.</span>
      </span>
      <a className="btn primary demo-banner-cta" href={VERCEL_DEPLOY_URL}>
        Deploy your own
      </a>
    </div>
  );
}
