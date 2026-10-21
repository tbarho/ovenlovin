/* eslint-disable no-undef */

export const NOT_A_PUBLIC_URL_CODE = "not_a_public_url";
export const NOT_A_PUBLIC_URL_MESSAGE =
  "That isn't a public web address. Use a public http or https address, or paste the recipe instead.";

export class NotAPublicUrlError extends Error {
  readonly code = NOT_A_PUBLIC_URL_CODE;

  constructor() {
    super(NOT_A_PUBLIC_URL_MESSAGE);
    this.name = "NotAPublicUrlError";
  }
}

const BLOCKED_HOST = /^(localhost|0\.0\.0\.0)$|(\.localhost|\.local|\.internal)$/i;
const IPV4_LITERAL = /^(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;

function stripHost(host: string): string {
  return (
    host
      .toLowerCase()
      .replace(/^\[|\]$/g, "")
      .split("%")[0] ?? ""
  );
}

function isIpv4Literal(host: string): boolean {
  return IPV4_LITERAL.test(host);
}

function ipv4FromMapped(host: string): string | null {
  if (!host.startsWith("::ffff:")) return null;
  const rest = host.slice(7);
  if (isIpv4Literal(rest)) return rest;
  const parts = rest.split(":");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  const hi = Number.parseInt(parts[0], 16);
  const lo = Number.parseInt(parts[1], 16);
  if (!Number.isInteger(hi) || !Number.isInteger(lo)) return null;
  return `${(hi >> 8) & 255}.${hi & 255}.${(lo >> 8) & 255}.${lo & 255}`;
}

/** Private, loopback, link-local, CGNAT, multicast, unspecified, metadata (IPv4/IPv6/mapped). */
export function isPrivateHttpIp(address: string): boolean {
  const host = stripHost(address);
  const mapped = ipv4FromMapped(host);
  if (mapped) return isPrivateHttpIp(mapped);
  if (isIpv4Literal(host)) {
    const [a, b] = host.split(".").map(Number);
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b != null && b >= 16 && b <= 31) return true;
    if (a === 100 && b != null && b >= 64 && b <= 127) return true;
    if (a === 198 && (b === 18 || b === 19)) return true;
    if (a != null && a >= 224 && a <= 239) return true;
    return false;
  }
  if (!host.includes(":")) return false;
  if (host === "::1" || host === "::") return true;
  if (host.startsWith("64:ff9b::") || /^64:ff9b:(?:0+:){4}/.test(host)) return true;
  const first = host.split(":")[0] ?? "";
  return (
    /^f[cd][0-9a-f]{2}$/.test(first) ||
    /^fe[89ab][0-9a-f]$/.test(first) ||
    /^ff[0-9a-f]{2}$/.test(first)
  );
}

function isIpLiteral(host: string): boolean {
  return host.includes(":") || isIpv4Literal(host);
}

function isBlockedHttpHost(host: string): boolean {
  const name = stripHost(host);
  return BLOCKED_HOST.test(name) || isPrivateHttpIp(name);
}

function publicHttpPort(url: URL): number {
  if (url.port === "") return url.protocol === "https:" ? 443 : 80;
  return Number(url.port);
}

/** Sync scheme, port 80/443, and hostname/literal-IP check. DNS is async. */
export function isPublicHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value.trim());
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    if (publicHttpPort(parsed) !== 80 && publicHttpPort(parsed) !== 443) return false;
    return !isBlockedHttpHost(parsed.hostname);
  } catch {
    return false;
  }
}

export async function assertPublicHttpUrl(value: string): Promise<void> {
  if (!isPublicHttpUrl(value)) throw new NotAPublicUrlError();
  const host = stripHost(new URL(value.trim()).hostname);
  if (!host || isIpLiteral(host)) return;
  try {
    // Client bundles import URL helpers; only the server fetch path loads dns.
    const { lookup } = await import(/* webpackIgnore: true */ "dns/promises");
    const answers = await lookup(host, { all: true });
    if (answers.length === 0 || answers.some((entry) => isPrivateHttpIp(entry.address))) {
      throw new NotAPublicUrlError();
    }
  } catch (error) {
    if (error instanceof NotAPublicUrlError) throw error;
    throw new NotAPublicUrlError();
  }
}

function isRedirectResponse(response: Response): boolean {
  return (
    response.status >= 300 && response.status < 400 && Boolean(response.headers?.get?.("location"))
  );
}

export type FetchPublicHttpInit = {
  fetchImpl?: typeof fetch;
  headers?: Record<string, string>;
  signal?: AbortSignal;
};

export async function fetchPublicHttp(
  url: string,
  init: FetchPublicHttpInit = {}
): Promise<Response> {
  let current = url;
  await assertPublicHttpUrl(current);
  const fetchImpl = init.fetchImpl ?? fetch;
  // shortcut: Node fetch cannot pin the resolved IP; re-check DNS on each hop, upgrade if undici can bind the address
  let response = await fetchImpl(current, {
    redirect: "manual",
    headers: init.headers,
    signal: init.signal,
  });
  for (let hops = 0; hops < 5 && isRedirectResponse(response); hops += 1) {
    const location = response.headers.get("location");
    if (!location) break;
    current = new URL(location, current).href;
    await assertPublicHttpUrl(current);
    response = await fetchImpl(current, {
      redirect: "manual",
      headers: init.headers,
      signal: init.signal,
    });
  }
  return response;
}
