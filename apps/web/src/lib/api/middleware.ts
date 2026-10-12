import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDatabase } from "@ovenlovin/db";
import { ApiKeyService } from "@ovenlovin/core";
import { eq } from "drizzle-orm";
import { household } from "@ovenlovin/db/schema";
import { UnauthorizedError } from "./errors";

export type RequestContext = {
  userId?: string;
  householdId?: string;
  isBot?: boolean;
  clientId?: string;
  membershipRole?: "owner" | "admin" | "member" | "viewer";
};

export async function getRequestContext(request: NextRequest): Promise<RequestContext> {
  const authHeader = request.headers.get("Authorization");

  if (!authHeader) {
    throw new UnauthorizedError("Missing authorization header");
  }

  if (authHeader.startsWith("Bearer ")) {
    return parseClerkAuth();
  }

  if (authHeader.startsWith("ApiKey ")) {
    const apiKey = authHeader.slice(7);
    return parseApiKey(apiKey);
  }

  throw new UnauthorizedError("Invalid authorization scheme. Use Bearer or ApiKey.");
}

async function parseClerkAuth(): Promise<RequestContext> {
  const { userId, orgId, orgRole } = await auth();

  if (!userId) {
    throw new UnauthorizedError("Authentication required");
  }

  if (!orgId) {
    throw new UnauthorizedError("Organization membership required");
  }

  const db = getDatabase();
  const [householdRecord] = await db
    .select()
    .from(household)
    .where(eq(household.clerkOrgId, orgId))
    .limit(1);

  if (!householdRecord) {
    throw new UnauthorizedError("Household not found for organization");
  }

  const role = orgRole as "owner" | "admin" | "member" | "viewer" | undefined;

  return {
    userId,
    householdId: householdRecord.id,
    membershipRole: role ?? "member",
  };
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
  if (!context.membershipRole || !["owner", "admin"].includes(context.membershipRole)) {
    throw new UnauthorizedError("Admin or owner role required");
  }
}
