type EnvLike = Record<string, string | undefined>;

/**
 * Vercel cron and internal job kicks share CRON_SECRET as a bearer token.
 * Preview and local may omit it: Vercel sets NODE_ENV=production on preview,
 * and CRON_SECRET is production-only, so NODE_ENV alone would 401 every kick.
 */
export function cronSecretRequired(env: EnvLike = process.env): boolean {
  if (env.VERCEL_ENV) return env.VERCEL_ENV === "production";
  return env.NODE_ENV === "production";
}

export function cronAuthorized(request: Request, env: EnvLike = process.env): boolean {
  const secret = env.CRON_SECRET?.trim();
  if (secret) return request.headers.get("authorization") === `Bearer ${secret}`;
  return !cronSecretRequired(env);
}

export function cronHeaders(env: EnvLike = process.env): Record<string, string> {
  const secret = env.CRON_SECRET?.trim();
  return secret ? { authorization: `Bearer ${secret}` } : {};
}
