export type EnvLike = Record<string, string | undefined>;

/**
 * Vercel AI Gateway authenticates with an explicit key or with the
 * deployment's OIDC token (`VERCEL_OIDC_TOKEN`). On Vercel, the AI SDK
 * resolves OIDC automatically, so a key is not required.
 */
export function isDemoModeEnv(env: EnvLike): boolean {
  const flag = env.OVENLOVIN_DEMO_MODE?.trim().toLowerCase();
  return flag === "1" || flag === "true";
}

function present(value: string | undefined): boolean {
  return Boolean(value?.trim());
}

/**
 * Shared source of truth for photo import and `/api/v1/status`.
 * Demo mode is not a substitute for credentials: if the gateway is
 * actually available (key, OIDC token, or Vercel runtime), report it.
 */
export function isAiGatewayConfigured(env: EnvLike): boolean {
  return present(env.AI_GATEWAY_API_KEY) || present(env.VERCEL_OIDC_TOKEN) || env.VERCEL === "1";
}

/** Name the env vars an operator must set when the shared check is false. */
export const AI_GATEWAY_MISSING_MESSAGE =
  "Photo import needs AI Gateway. Set AI_GATEWAY_API_KEY, or on Vercel enable OIDC so VERCEL_OIDC_TOKEN is available.";
