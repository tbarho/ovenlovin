import { NextRequest } from "next/server";
import { handleApiError, NotFoundError } from "@/lib/api/errors";
import { jsonResponse } from "@/lib/api/response";
import {
  getRequestContext,
  requireHouseholdId,
  requireWritableHousehold,
} from "@/lib/api/middleware";
import {
  PlanService,
  parseShoppingTripState,
  shoppingTripStateWriteSchema,
} from "@ovenlovin/core";
import { getDatabase } from "@ovenlovin/db";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getRequestContext(request);
    const householdId = requireHouseholdId(context);
    const { id } = await params;

    const db = getDatabase();
    const service = new PlanService(db);
    const plan = await service.getMealPlan(id);
    if (!plan || plan.householdId !== householdId) {
      throw new NotFoundError("MealPlan", id);
    }

    return jsonResponse(parseShoppingTripState(plan.shoppingState));
  } catch (error) {
    return handleApiError(error, request.url);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getRequestContext(request);
    const householdId = requireWritableHousehold(context);
    const { id } = await params;
    const shoppingState = parseShoppingTripState(
      shoppingTripStateWriteSchema.parse(await request.json())
    );

    const db = getDatabase();
    const service = new PlanService(db);
    const existing = await service.getMealPlan(id);
    if (!existing || existing.householdId !== householdId) {
      throw new NotFoundError("MealPlan", id);
    }

    const plan = await service.updateMealPlan(id, { shoppingState });
    if (!plan) {
      throw new NotFoundError("MealPlan", id);
    }

    return jsonResponse(parseShoppingTripState(plan.shoppingState));
  } catch (error) {
    return handleApiError(error, request.url);
  }
}
