import { NextRequest } from "next/server";
import {
  ApiKeyService,
  createApiKeyInputSchema,
  toPublicApiKey,
  toPublicApiKeyWithPlaintext,
} from "@ovenlovin/core";
import { getDatabase } from "@ovenlovin/db";
import { handleApiError } from "@/lib/api/errors";
import { createdResponse, jsonResponse } from "@/lib/api/response";
import {
  getRequestContext,
  requireAdminRole,
  requireHouseholdId,
  requireUserId,
} from "@/lib/api/middleware";

const defaultScopes = [
  "recipes:read",
  "recipes:write",
  "plans:read",
  "plans:write",
  "people:read",
  "people:write",
  "lists:export",
] as const;

export async function GET(request: NextRequest) {
  try {
    const context = await getRequestContext(request);
    const householdId = requireHouseholdId(context);
    const db = getDatabase();
    const keys = await new ApiKeyService(db).listForHousehold(householdId);
    return jsonResponse({ items: keys.map(toPublicApiKey) });
  } catch (error) {
    return handleApiError(error, request.url);
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await getRequestContext(request);
    requireAdminRole(context);
    const householdId = requireHouseholdId(context);
    const createdBy = requireUserId(context);

    const body = await request.json().catch(() => ({}));
    const input = createApiKeyInputSchema.parse({
      householdId,
      name: typeof body.name === "string" && body.name.trim() ? body.name.trim() : "Agent key",
      scopes: Array.isArray(body.scopes) && body.scopes.length > 0 ? body.scopes : defaultScopes,
    });

    const db = getDatabase();
    const key = await new ApiKeyService(db).create(input, createdBy);
    return createdResponse(toPublicApiKeyWithPlaintext(key), `/api/v1/api-keys/${key.id}`);
  } catch (error) {
    return handleApiError(error, request.url);
  }
}
