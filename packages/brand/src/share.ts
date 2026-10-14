/** GitHub Pages origin for the docs site (includes the repo base path). */
export const DOCS_SHARE_ORIGIN = "https://tbarho.github.io/ovenlovin";

const DEFAULT_APP_ORIGIN = "https://ovenlovin.vercel.app";

export function appShareOrigin(env: Record<string, string | undefined> = process.env): string {
  const configured = env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (configured) return configured;
  if (env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  return DEFAULT_APP_ORIGIN;
}

/** Resolve a public path (e.g. `/brand/og.png`) to an absolute https URL. */
export function absoluteShareUrl(origin: string, publicPath: string): string {
  const base = `${origin.replace(/\/$/, "")}/`;
  const relative = publicPath.replace(/^\//, "");
  const url = new URL(relative, base);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(`Share URL must be http(s): ${url.href}`);
  }
  if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
    throw new Error(`Share URL must not be localhost: ${url.href}`);
  }
  return url.href;
}

export function docsShareUrl(publicPath: string): string {
  return absoluteShareUrl(DOCS_SHARE_ORIGIN, publicPath);
}

export function appShareUrl(
  publicPath: string,
  env: Record<string, string | undefined> = process.env
): string {
  return absoluteShareUrl(appShareOrigin(env), publicPath);
}
