import { NextRequest } from "next/server";
import { handleApiError, requireResourceId } from "@/lib/api/errors";
import { jsonResponse } from "@/lib/api/response";
import { getRequestContext, requireHouseholdId } from "@/lib/api/middleware";
import { persistMealPlanCheck, runMealPlanCheck } from "@/lib/run-meal-plan-check";

async function handleCheck(request: NextRequest, params: Promise<{ id: string }>, persist = false) {
  const context = await getRequestContext(request);
  const householdId = requireHouseholdId(context);

  const { id } = await params;
  requireResourceId("MealPlan", id);

  const report = persist
    ? await persistMealPlanCheck(id, householdId)
    : await runMealPlanCheck(id, householdId);
  return jsonResponse(report);
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    return await handleCheck(request, context.params, false);
  } catch (error) {
    return handleApiError(error, request.url);
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    return await handleCheck(request, context.params, true);
  } catch (error) {
    return handleApiError(error, request.url);
  }
}
