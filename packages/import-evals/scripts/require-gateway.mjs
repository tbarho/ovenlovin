const key = process.env.AI_GATEWAY_API_KEY?.trim();
const oidc = process.env.VERCEL_OIDC_TOKEN?.trim();
if (!key && !oidc) {
  console.error(
    "eval:import needs AI_GATEWAY_API_KEY or VERCEL_OIDC_TOKEN. This suite is not part of CI."
  );
  process.exit(1);
}
