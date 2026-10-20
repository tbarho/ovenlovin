import { NextRequest } from "next/server";
import { z } from "zod";
import { PeopleOrderError, PeopleService } from "@ovenlovin/core";
import { getDatabase } from "@ovenlovin/db";
import { BadRequestError, handleApiError } from "@/lib/api/errors";
import { getRequestContext, requireWritableHousehold } from "@/lib/api/middleware";
import { jsonResponse } from "@/lib/api/response";

const reorderPeopleSchema = z.object({
  personIds: z.array(z.string().uuid()).min(1),
});

export async function POST(request: NextRequest) {
  try {
    const context = await getRequestContext(request);
    const householdId = requireWritableHousehold(context);
    const body = reorderPeopleSchema.parse(await request.json());

    const service = new PeopleService(getDatabase());
    const people = await service.reorderPeople(householdId, body.personIds);
    return jsonResponse({ items: people });
  } catch (error) {
    if (error instanceof PeopleOrderError) {
      return new BadRequestError(error.message).toResponse(request.url);
    }
    return handleApiError(error, request.url);
  }
}
