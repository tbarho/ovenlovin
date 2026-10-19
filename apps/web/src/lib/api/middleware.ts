import { NextRequest } from "next/server";
import { getDatabase } from "@ovenlovin/db";
import { ApiKeyService, HouseholdService } from "@ovenlovin/core";
import { enforceDemoRequestGuards } from "@/lib/demo/enforce";
import { getSessionContext } from "@/lib/session";
import { ForbiddenError, UnauthorizedError } from "./errors";
import { restAuthFromHeader } from "./request-auth";

export type RequestContext = {
  userId?: string;
  clerkUserId?: string;
  householdId?: string;
  isBot?: boolean;
  clientId?: string;
  /** User who minted the API key. Used to attribute writes (set_by / created_by). */
  apiKeyCreatedBy?: string;
  membershipRole?: "owner" | "admin" | "member" | "viewer";
};

export async function getRequestContext(request: NextRequest): Promise<RequestContext> {
  const auth = restAuthFromHeader(request.headers.get("Authorization"));
  const context = auth.kind === "apiKey" ? await parseApiKey(auth.token) : await parseClerkAuth();
  await enforceDemoRequestGuards(request, context);
  return context;
}

async function parseClerkAuth(): Promise<RequestContext> {
  return getSessionContext({ allowRedirect: false });
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

  const memberships = await new HouseholdService(db).getMembershipsForUser(result.key.createdBy);

  return {
    clientId: result.key.id,
    householdId: result.key.householdId,
    isBot: true,
    apiKeyCreatedBy: result.key.createdBy,
    membershipRole: apiKeyMembershipRole(memberships, result.key.householdId),
  };
}

/** Creator's current role in the key's kitchen - not a role from another household. */
export function apiKeyMembershipRole(
  memberships: Array<{ householdId: string; role: NonNullable<RequestContext["membershipRole"]> }>,
  householdId: string
): RequestContext["membershipRole"] {
  return memberships.find((item) => item.householdId === householdId)?.role;
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

/** Signed-in user, or the household member who minted this API key. */
export function requireUserOrKeyOwner(context: RequestContext): string {
  const id = context.userId ?? context.apiKeyCreatedBy;
  if (!id) {
    throw new UnauthorizedError("User authentication required");
  }
  return id;
}

export function requireAdminRole(context: RequestContext): void {
  if (!context.membershipRole || !["owner", "admin"].includes(context.membershipRole)) {
    throw new ForbiddenError("Admin or owner role required");
  }
}

export function requireOwnerRole(context: RequestContext): void {
  if (context.membershipRole !== "owner") {
    throw new ForbiddenError("Owner role required");
  }
}
