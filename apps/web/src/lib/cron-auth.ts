/** Vercel cron and internal job kicks share CRON_SECRET as a bearer token. */
export function cronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return process.env.NODE_ENV !== "production";
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export function cronHeaders(): Record<string, string> {
  const secret = process.env.CRON_SECRET?.trim();
  return secret ? { authorization: `Bearer ${secret}` } : {};
}
