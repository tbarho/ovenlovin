import { NextRequest } from "next/server";
import { handleApiError } from "@/lib/api/errors";
import { jsonResponse, paginatedResponse, createdResponse } from "@/lib/api/response";
import { getRequestContext, requireHouseholdId, getIdempotencyKey } from "@/lib/api/middleware";
import { PlanService, resolveWriteActor } from "@ovenlovin/core";
import { getDatabase } from "@ovenlovin/db";

export async function GET(request: NextRequest) {
  try {
    const context = await getRequestContext(request);
    const householdId = requireHouseholdId(context);

    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get("limit") || "20");
    const cursor = url.searchParams.get("cursor") || undefined;
    const status = url.searchParams.get("status") || undefined;
    const weekStart = url.searchParams.get("weekStart") || undefined;
    const weekEnd = url.searchParams.get("weekEnd") || undefined;

    const db = getDatabase();
    const service = new PlanService(db);

    const result = await service.listMealPlans(householdId, {
      status,
      weekStart,
      weekEnd,
      pagination: { limit, cursor },
    });

    return paginatedResponse(result);
  } catch (error) {
    return handleApiError(error, request.url);
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await getRequestContext(request);
    const householdId = requireHouseholdId(context);
    const idempotencyKey = getIdempotencyKey(request);

    const body = await request.json();

    const db = getDatabase();
    const service = new PlanService(db);

    const actor = resolveWriteActor({
      userId: context.userId,
      apiKeyId: context.clientId,
      apiKeyCreatedBy: context.apiKeyCreatedBy,
    });

    const plan = await service.createMealPlan({
      ...body,
      householdId,
      createdBy: actor.createdBy,
      createdByApiKeyId: actor.createdByApiKeyId,
    });

    return createdResponse(plan, `/api/v1/meal-plans/${plan.id}`);
  } catch (error) {
    return handleApiError(error, request.url);
  }
}
