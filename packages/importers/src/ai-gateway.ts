import { gateway } from "@ai-sdk/gateway";

/**
 * AI Gateway model handle used by paste/photo importers.
 *
 * Auth resolution (handled by the AI SDK, do not override with an empty key):
 * 1. `AI_GATEWAY_API_KEY` when set
 * 2. `VERCEL_OIDC_TOKEN` / `@vercel/oidc` on Vercel deployments
 */
export function gatewayModel(modelId: string) {
  return gateway(modelId);
}
