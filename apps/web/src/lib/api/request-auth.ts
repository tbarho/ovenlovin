import { parseAuthorizationHeader } from "@ovenlovin/mcp";
import { UnauthorizedError } from "./errors";

export type RestAuth = { kind: "apiKey"; token: string } | { kind: "session" };

/**
 * Decide whether this request is an API key (bot) or a household session.
 * Missing Authorization falls through to Clerk / e2e session.
 * A present but invalid key is a JSON 401, not a session.
 */
export function restAuthFromHeader(header: string | null | undefined): RestAuth {
  if (!header?.trim()) return { kind: "session" };

  try {
    const parsed = parseAuthorizationHeader(header);
    if (parsed.kind === "apiKey") {
      return { kind: "apiKey", token: parsed.token };
    }
    return { kind: "session" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unauthorized";
    throw new UnauthorizedError(message);
  }
}
