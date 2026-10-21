import { NextRequest } from "next/server";
import { handleApiError } from "@/lib/api/errors";
import { loadOwned } from "@/lib/api/owned";
import { jsonResponse } from "@/lib/api/response";
import { getRequestContext, requireHouseholdId } from "@/lib/api/middleware";
import { PlanService } from "@ovenlovin/core";
import { getDatabase } from "@ovenlovin/db";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getRequestContext(request);
    const householdId = requireHouseholdId(context);
    const { id } = await params;
    const service = new PlanService(getDatabase());
    await loadOwned("MealPlan", id, householdId, (planId) => service.getMealPlan(planId));

    const items = await service.getPlanHistory(id);
    return jsonResponse({ items });
  } catch (error) {
    return handleApiError(error, request.url);
  }
}
