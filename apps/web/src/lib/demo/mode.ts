/**
 * Public no-signup demo mode.
 *
 * Enabled only when OVENLOVIN_DEMO_MODE=1 (or "true"). The product Vercel
 * production project must never enter demo mode: a production build fails
 * closed unless this is the dedicated demo project (OVENLOVIN_DEMO_PROJECT=1).
 *
 * Keep all demo runtime logic under `apps/web/src/lib/demo/` so it stays
 * isolated from Clerk, e2e bypass, and product auth.
 */

export type EnvLike = Record<string, string | undefined>;

export const DEMO_SHARE_OFF = "Share links are turned off in the public demo.";
export const DEMO_PDF_OFF = "Print PDFs are turned off in the public demo.";

export function isTruthyEnvFlag(value: string | undefined): boolean {
  const flag = value?.trim().toLowerCase();
  return flag === "1" || flag === "true";
}

export function isVercelProductionBuild(env: EnvLike = process.env): boolean {
  if (env.VERCEL_ENV === "production") return true;
  return env.VERCEL === "1" && env.NODE_ENV === "production";
}

export function isDemoProjectConfirmed(env: EnvLike = process.env): boolean {
  return isTruthyEnvFlag(env.OVENLOVIN_DEMO_PROJECT);
}

/** The main OvenLovin Vercel production project - never a demo host. */
export function isProductVercelProduction(env: EnvLike = process.env): boolean {
  return isVercelProductionBuild(env) && !isDemoProjectConfirmed(env);
}

export function isDemoModeRequested(env: EnvLike = process.env): boolean {
  return isTruthyEnvFlag(env.OVENLOVIN_DEMO_MODE);
}

export function isDemoModeEnabled(env: EnvLike = process.env): boolean {
  if (isProductVercelProduction(env)) return false;
  return isDemoModeRequested(env);
}

export function assertDemoModeSafeForBuild(env: EnvLike = process.env): void {
  if (isProductVercelProduction(env) && isDemoModeRequested(env)) {
    throw new Error(
      "OVENLOVIN_DEMO_MODE cannot be enabled on the product Vercel production project. Create a separate demo project, set OVENLOVIN_DEMO_PROJECT=1 there, and leave this flag unset on the product deploy."
    );
  }
}

export function getPublicDemoUrl(env: EnvLike = process.env): string | null {
  const url = env.NEXT_PUBLIC_DEMO_URL?.trim();
  if (!url) return null;
  return url.replace(/\/$/, "");
}
