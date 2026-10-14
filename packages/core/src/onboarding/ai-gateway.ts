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

export function isAiGatewayConfigured(env: EnvLike): boolean {
  if (isDemoModeEnv(env)) return false;
  return Boolean(env.AI_GATEWAY_API_KEY || env.VERCEL_OIDC_TOKEN || env.VERCEL === "1");
}
