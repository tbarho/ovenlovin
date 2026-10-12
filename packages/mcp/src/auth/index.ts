/**
 * Authentication and authorization for MCP server
 *
 * Supports:
 * - OAuth 2.1 via Clerk (for ChatGPT, Claude Desktop)
 * - Scoped API keys (for Grok Bot, CLI)
 */

export interface AuthContext {
  householdId: string;
  userId: string;
  scopes: string[];
  apiKeyId?: string;
}

export interface AuthError {
  code: "unauthorized" | "forbidden" | "invalid_token";
  message: string;
}

/**
 * Authenticate a request and return auth context
 *
 * TODO: Implement OAuth and API key validation
 *
 * @param headers Request headers containing Authorization
 * @returns Auth context if valid
 * @throws AuthError if authentication fails
 */
export async function authenticateRequest(headers: Record<string, string>): Promise<AuthContext> {
  const authHeader = headers["authorization"] || headers["Authorization"];

  if (!authHeader) {
    throw {
      code: "unauthorized",
      message: "Missing Authorization header",
    } as AuthError;
  }

  // TODO: Implement actual auth
  // For OAuth: verify Clerk token, extract org (household) and user
  // For API keys: validate key, extract household, user, and scopes

  // Stub implementation
  return {
    householdId: "household-stub",
    userId: "user-stub",
    scopes: ["recipes:read", "recipes:write", "plans:write", "people:read"],
  };
}

/**
 * Check if auth context has required scope
 */
export function requireScope(context: AuthContext, scope: string): void {
  if (!context.scopes.includes(scope)) {
    throw {
      code: "forbidden",
      message: `Missing required scope: ${scope}`,
    } as AuthError;
  }
}
