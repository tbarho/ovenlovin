import { NextRequest } from "next/server";
import { UnauthorizedError } from "./errors";

export type RequestContext = {
  userId?: string;
  householdId?: string;
  isBot?: boolean;
  clientId?: string;
};

export async function getRequestContext(request: NextRequest): Promise<RequestContext> {
  const authHeader = request.headers.get("Authorization");

  if (!authHeader) {
    throw new UnauthorizedError("Missing authorization header");
  }

  if (authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    return parseBearerToken(token);
  }

  if (authHeader.startsWith("ApiKey ")) {
    const apiKey = authHeader.slice(7);
    return parseApiKey(apiKey);
  }

  throw new UnauthorizedError("Invalid authorization scheme. Use Bearer or ApiKey.");
}

async function parseBearerToken(token: string): Promise<RequestContext> {
  if (!token) {
    throw new UnauthorizedError("Invalid bearer token");
  }

  return {
    userId: "user-stub",
    householdId: "household-stub",
  };
}

async function parseApiKey(apiKey: string): Promise<RequestContext> {
  if (!apiKey) {
    throw new UnauthorizedError("Invalid API key");
  }

  return {
    clientId: "bot-stub",
    householdId: "household-stub",
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
