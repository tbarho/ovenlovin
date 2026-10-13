/**
 * Test-only auth bypass for the signed-in kitchen e2e harness.
 *
 * Active only when NODE_ENV=test or E2E_AUTH_BYPASS=1, and never in a
 * Vercel production build. next.config.ts calls assertE2eAuthBypassSafeForBuild
 * so a production deploy fails closed if the flag is set.
 */

export type EnvLike = Record<string, string | undefined>;

export function isVercelProductionBuild(env: EnvLike = process.env): boolean {
  if (env.VERCEL_ENV === "production") return true;
  return env.VERCEL === "1" && env.NODE_ENV === "production";
}

export function isE2eAuthBypassRequested(env: EnvLike = process.env): boolean {
  const flag = env.E2E_AUTH_BYPASS?.trim().toLowerCase();
  if (flag === "1" || flag === "true") return true;
  return env.NODE_ENV === "test";
}

export function isE2eAuthBypassEnabled(env: EnvLike = process.env): boolean {
  if (isVercelProductionBuild(env)) return false;
  return isE2eAuthBypassRequested(env);
}

export function assertE2eAuthBypassSafeForBuild(env: EnvLike = process.env): void {
  if (isVercelProductionBuild(env) && isE2eAuthBypassRequested(env)) {
    throw new Error(
      "E2E auth bypass cannot be enabled in a Vercel production build. Unset E2E_AUTH_BYPASS (and do not use NODE_ENV=test) on production deploys."
    );
  }
}
