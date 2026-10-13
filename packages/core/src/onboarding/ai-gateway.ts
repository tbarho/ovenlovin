export type EnvLike = Record<string, string | undefined>;

/**
 * Vercel AI Gateway authenticates with an explicit key or with the
 * deployment's OIDC token (`VERCEL_OIDC_TOKEN`). On Vercel, the AI SDK
 * resolves OIDC automatically, so a key is not required.
 */
export function isAiGatewayConfigured(env: EnvLike): boolean {
  return Boolean(env.AI_GATEWAY_API_KEY || env.VERCEL_OIDC_TOKEN || env.VERCEL === "1");
}
