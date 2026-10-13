import { NextRequest } from "next/server";
import { getDatabase } from "@ovenlovin/db";
import { ApiKeyService } from "@ovenlovin/core";
import { getSessionContext } from "@/lib/session";
import { UnauthorizedError } from "./errors";

export type RequestContext = {
  userId?: string;
  clerkUserId?: string;
  householdId?: string;
  isBot?: boolean;
  clientId?: string;
  membershipRole?: "owner" | "admin" | "member" | "viewer";
};

export async function getRequestContext(request: NextRequest): Promise<RequestContext> {
  const authHeader = request.headers.get("Authorization");

  if (authHeader?.startsWith("ApiKey ")) {
    return parseApiKey(authHeader.slice(7).trim());
  }

  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    if (token.startsWith("rkapi_")) {
      return parseApiKey(token);
    }
  }

  return parseClerkAuth();
}

async function parseClerkAuth(): Promise<RequestContext> {
  return getSessionContext();
}

async function parseApiKey(apiKey: string): Promise<RequestContext> {
  if (!apiKey) {
    throw new UnauthorizedError("Invalid API key");
  }

  const db = getDatabase();
  const apiKeyService = new ApiKeyService(db);
  const result = await apiKeyService.validate(apiKey);

  if (!result.valid) {
    throw new UnauthorizedError("Invalid or expired API key");
  }

  return {
    clientId: result.key.id,
    householdId: result.key.householdId,
    isBot: true,
  };
}

export function getIdempotencyKey(request: NextRequest): string | undefined {
  return request.headers.get("Idempotency-Key") ?? undefined;
}

export function requireHouseholdId(context: RequestContext): string {
  if (!context.householdId) {
    throw new UnauthorizedError("Household context required");
  }
  return context.householdId;
}

export function requireUserId(context: RequestContext): string {
  if (!context.userId) {
    throw new UnauthorizedError("User authentication required");
  }
  return context.userId;
}

export function requireAdminRole(context: RequestContext): void {
  if (context.isBot) return;
  if (!context.membershipRole || !["owner", "admin"].includes(context.membershipRole)) {
    throw new UnauthorizedError("Admin or owner role required");
  }
}
