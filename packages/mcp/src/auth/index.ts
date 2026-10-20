import { verifyToken } from "@clerk/backend";
import { getDatabase } from "@ovenlovin/db";
import {
  API_KEY_CREATOR_NOT_A_MEMBER,
  ApiKeyService,
  HouseholdService,
  apiKeyMembershipRole,
  canWriteKitchen,
  selectActiveMembership,
} from "@ovenlovin/core";
import { parseAuthorizationHeader } from "./authorization";

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
  /** User who minted the API key. Used to attribute writes (set_by / created_by). */
  apiKeyCreatedBy?: string;
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
  try {
    const scheme = parseAuthorizationHeader(headers["authorization"] || headers["Authorization"]);
    if (scheme.kind === "apiKey") {
      return parseApiKey(scheme.token);
    }
    return parseClerkToken(scheme.token, headers);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error) {
      throw error;
    }
    throw {
      code: "unauthorized",
      message: "Invalid authorization scheme. Use Bearer or ApiKey.",
    } as AuthError;
  }
}

const CLERK_NO_KITCHEN =
  "Open OvenLovin once in the browser to set up your kitchen, or use an API key.";

async function parseClerkToken(
  token: string,
  headers: Record<string, string>
): Promise<AuthContext> {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    throw {
      code: "unauthorized",
      message: "Bearer tokens are not supported on this server. Use ApiKey.",
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

    const db = getDatabase();
    const households = new HouseholdService(db);
    const userRecord = await households.getUserByClerkId(verifiedToken.sub);
    if (!userRecord) {
      throw {
        code: "unauthorized",
        message: CLERK_NO_KITCHEN,
      } as AuthError;
    }

    const memberships = await households.getMembershipsForUser(userRecord.id);
    const preferred = headers["x-kitchen-id"] ?? headers["X-Kitchen-Id"];
    let membership = null;
    if (preferred) {
      membership = memberships.find((item) => item.householdId === preferred) ?? null;
      if (!membership) {
        throw {
          code: "unauthorized",
          message: "You are not a member of that kitchen. Check X-Kitchen-Id.",
        } as AuthError;
      }
    } else {
      const orgId = (verifiedToken as Record<string, unknown>).org_id;
      if (typeof orgId === "string" && orgId) {
        const orgHousehold = await households.getHouseholdByClerkOrgId(orgId);
        membership = orgHousehold
          ? (memberships.find((item) => item.householdId === orgHousehold.id) ?? null)
          : null;
      }
      if (!membership) {
        membership = selectActiveMembership(memberships);
      }
    }

    if (!membership) {
      throw {
        code: "unauthorized",
        message: CLERK_NO_KITCHEN,
      } as AuthError;
    }

    return {
      householdId: membership.householdId,
      userId: userRecord.id,
      scopes: deriveScopes(membership.role),
      membershipRole: membership.role,
    };
  } catch (error) {
    if (error && typeof error === "object" && "code" in error) {
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

  const memberships = await new HouseholdService(db).getMembershipsForUser(result.key.createdBy);
  const membershipRole = apiKeyMembershipRole(memberships, result.key.householdId);
  if (!membershipRole) {
    throw {
      code: "unauthorized",
      message: API_KEY_CREATOR_NOT_A_MEMBER,
    } as AuthError;
  }

  return {
    householdId: result.key.householdId,
    scopes: result.key.scopes,
    apiKeyId: result.key.id,
    apiKeyCreatedBy: result.key.createdBy,
    membershipRole,
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

export function requireWriteRole(context: AuthContext): void {
  if (!canWriteKitchen(context.membershipRole)) {
    throw {
      code: "forbidden",
      message: "Member, admin, or owner role required",
    } as AuthError;
  }
}
