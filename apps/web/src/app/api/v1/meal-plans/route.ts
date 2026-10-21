import { NextRequest } from "next/server";
import { handleApiError } from "@/lib/api/errors";
import { jsonResponse, paginatedResponse, createdResponse } from "@/lib/api/response";
import {
  getRequestContext,
  requireHouseholdId,
  requireWritableHousehold,
  getIdempotencyKey,
} from "@/lib/api/middleware";
import {
  agreedEntryCookFor,
  createMealPlanBodySchema,
  PlanService,
  RecipeService,
  resolveWriteActor,
} from "@ovenlovin/core";
import { readJsonBody } from "@/lib/api/read-json";
import { getDatabase } from "@ovenlovin/db";
import { persistMealPlanCheck } from "@/lib/run-meal-plan-check";

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
    const householdId = requireWritableHousehold(context);
    const idempotencyKey = getIdempotencyKey(request);

    const body = await readJsonBody(request, createMealPlanBodySchema);

    const db = getDatabase();
    const service = new PlanService(db);

    const actor = resolveWriteActor({
      userId: context.userId,
      apiKeyId: context.clientId,
      apiKeyCreatedBy: context.apiKeyCreatedBy,
    });

    if (body.entries) {
      await new RecipeService(db).requireOwnedRecipeIds(
        householdId,
        body.entries.map((entry) => entry.recipeId)
      );
    }

    const plan = await service.createMealPlan({
      householdId,
      weekStart: body.weekStart,
      cookFor:
        body.cookFor ?? agreedEntryCookFor(body.entries?.map((entry) => entry.servings) ?? []),
      status: body.status ?? "draft",
      acknowledgedWarnings: [],
      needsRecheck: false,
      createdBy: actor.createdBy,
      createdByApiKeyId: actor.createdByApiKeyId,
    });

    if (body.entries) {
      await service.replaceMealPlanEntries(plan.id, body.entries, { recordHistory: false });
      try {
        await persistMealPlanCheck(plan.id, householdId);
      } catch {
        // Dinner is saved. The recheck banner stays if this check cannot finish.
      }
    }

    const detail = await service.getMealPlanWithEntries(plan.id);
    return createdResponse(detail ?? plan, `/api/v1/meal-plans/${plan.id}`);
  } catch (error) {
    return handleApiError(error, request.url);
  }
}
