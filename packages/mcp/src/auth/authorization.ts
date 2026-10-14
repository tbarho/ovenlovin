export type AuthorizationScheme =
  { kind: "apiKey"; token: string } | { kind: "clerk"; token: string };

/**
 * Accept the schemes agents actually send:
 * - `ApiKey rkapi_…`
 * - `Bearer rkapi_…` (ChatGPT Actions, some MCP clients)
 * - `Bearer <Clerk JWT>`
 * - bare `rkapi_…`
 */
export function parseAuthorizationHeader(header: string | undefined | null): AuthorizationScheme {
  const value = header?.trim();
  if (!value) {
    throw Object.assign(new Error("Missing Authorization header"), { code: "unauthorized" });
  }

  if (value.toLowerCase().startsWith("apikey")) {
    const token = value.slice(6).trim();
    if (!token) {
      throw Object.assign(new Error("Invalid API key"), { code: "unauthorized" });
    }
    return { kind: "apiKey", token };
  }

  if (value.toLowerCase().startsWith("bearer")) {
    const token = value.slice(6).trim();
    if (!token) {
      throw Object.assign(new Error("Invalid bearer token"), { code: "unauthorized" });
    }
    if (token.startsWith("rkapi_")) {
      return { kind: "apiKey", token };
    }
    return { kind: "clerk", token };
  }

  if (value.startsWith("rkapi_")) {
    return { kind: "apiKey", token: value };
  }

  throw Object.assign(new Error("Invalid authorization scheme. Use Bearer or ApiKey."), {
    code: "unauthorized",
  });
}
