import { NextRequest } from "next/server";
import { CookbookService } from "@ovenlovin/core";
import { getDatabase } from "@ovenlovin/db";
import { handleApiError, BadRequestError } from "@/lib/api/errors";
import { createdResponse, paginatedResponse } from "@/lib/api/response";
import {
  getRequestContext,
  requireHouseholdId,
  requireWritableHousehold,
} from "@/lib/api/middleware";

export async function GET(request: NextRequest) {
  try {
    const context = await getRequestContext(request);
    const householdId = requireHouseholdId(context);
    const url = new URL(request.url);
    const cards = url.searchParams.get("view") === "cards";
    const db = getDatabase();
    const service = new CookbookService(db);

    if (cards) {
      const items = await service.listCookbookCards(householdId);
      return paginatedResponse({ items, nextCursor: null, hasMore: false });
    }

    const result = await service.listCookbooks(householdId, {
      limit: parseInt(url.searchParams.get("limit") || "50"),
      cursor: url.searchParams.get("cursor") || undefined,
    });
    return paginatedResponse(result);
  } catch (error) {
    return handleApiError(error, request.url);
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await getRequestContext(request);
    const householdId = requireWritableHousehold(context);
    const body = (await request.json()) as { name?: string; description?: string };
    if (!body.name?.trim()) {
      throw new BadRequestError("Cookbook name is required");
    }

    const createdBy = context.userId || context.clientId;
    if (!createdBy) {
      throw new BadRequestError("A user or API key is required to create a cookbook");
    }

    const cookbook = await new CookbookService(getDatabase()).createCookbook({
      householdId,
      name: body.name,
      description: body.description ?? null,
      createdBy,
    });

    return createdResponse(cookbook, `/api/v1/cookbooks/${cookbook.id}`);
  } catch (error) {
    return handleApiError(error, request.url);
  }
}
