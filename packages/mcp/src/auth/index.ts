import { verifyToken } from "@clerk/backend";
import { getDatabase } from "@ovenlovin/db";
import { ApiKeyService } from "@ovenlovin/core";
import { eq } from "drizzle-orm";
import { household } from "@ovenlovin/db/schema";

/**
 * Authentication and authorization for MCP server
 *
 * Supports:
 * - OAuth 2.1 via Clerk (for ChatGPT, Claude Desktop)
 * - Scoped API keys (for Grok Bot, CLI)
 */

export interface AuthContext {
  householdId: string;
  userId?: string;
  scopes: string[];
  apiKeyId?: string;
  membershipRole?: "owner" | "admin" | "member" | "viewer";
}

export interface AuthError {
  code: "unauthorized" | "forbidden" | "invalid_token";
  message: string;
}

/**
 * Authenticate a request and return auth context
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

  if (authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    return parseClerkToken(token);
  }

  if (authHeader.startsWith("ApiKey ")) {
    const apiKey = authHeader.slice(7);
    return parseApiKey(apiKey);
  }

  throw {
    code: "unauthorized",
    message: "Invalid authorization scheme. Use Bearer or ApiKey.",
  } as AuthError;
}

async function parseClerkToken(token: string): Promise<AuthContext> {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    throw {
      code: "unauthorized",
      message: "Server configuration error: CLERK_SECRET_KEY not set",
    } as AuthError;
  }

  try {
    const verifiedToken = await verifyToken(token, {
      secretKey,
    });

    if (!verifiedToken.sub) {
      throw {
        code: "invalid_token",
        message: "Token does not contain user ID",
      } as AuthError;
    }

    const userId = verifiedToken.sub;

    const orgId = (verifiedToken as any).org_id;
    const orgRole = (verifiedToken as any).org_role;

    if (!orgId) {
      throw {
        code: "unauthorized",
        message: "Organization membership required",
      } as AuthError;
    }

    const db = getDatabase();
    const [householdRecord] = await db
      .select()
      .from(household)
      .where(eq(household.clerkOrgId, orgId))
      .limit(1);

    if (!householdRecord) {
      throw {
        code: "unauthorized",
        message: "Household not found for organization",
      } as AuthError;
    }

    const role = orgRole as "owner" | "admin" | "member" | "viewer" | undefined;
    const scopes = deriveScopes(role ?? "member");

    return {
      householdId: householdRecord.id,
      userId,
      scopes,
      membershipRole: role ?? "member",
    };
  } catch (error) {
    if ((error as any).code) {
      throw error;
    }
    throw {
      code: "invalid_token",
      message: "Invalid or expired token",
    } as AuthError;
  }
}

async function parseApiKey(apiKey: string): Promise<AuthContext> {
  if (!apiKey) {
    throw {
      code: "unauthorized",
      message: "Invalid API key",
    } as AuthError;
  }

  const db = getDatabase();
  const apiKeyService = new ApiKeyService(db);
  const result = await apiKeyService.validate(apiKey);

  if (!result.valid) {
    throw {
      code: "unauthorized",
      message: "Invalid or expired API key",
    } as AuthError;
  }

  return {
    householdId: result.key.householdId,
    scopes: result.key.scopes,
    apiKeyId: result.key.id,
  };
}

/**
 * Derive scopes from membership role
 */
function deriveScopes(role: "owner" | "admin" | "member" | "viewer"): string[] {
  const baseScopes = ["recipes:read", "plans:read"];

  switch (role) {
    case "owner":
    case "admin":
      return [
        ...baseScopes,
        "recipes:write",
        "plans:write",
        "people:read",
        "people:write",
        "lists:export",
      ];
    case "member":
      return [...baseScopes, "recipes:write", "plans:write", "lists:export"];
    case "viewer":
      return baseScopes;
    default:
      return baseScopes;
  }
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

/**
 * Require admin or owner role
 */
export function requireAdminRole(context: AuthContext): void {
  if (!context.membershipRole || !["owner", "admin"].includes(context.membershipRole)) {
    throw {
      code: "forbidden",
      message: "Admin or owner role required",
    } as AuthError;
  }
}
