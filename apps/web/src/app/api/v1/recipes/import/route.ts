import { NextRequest } from "next/server";
import { createPasteImporter, createUrlImporter } from "@ovenlovin/importers";
import { RecipeService } from "@ovenlovin/core";
import { isAiGatewayConfigured } from "@ovenlovin/core/onboarding";
import { getDatabase } from "@ovenlovin/db";
import { BadRequestError, handleApiError } from "@/lib/api/errors";
import { createdResponse } from "@/lib/api/response";
import { getRequestContext, requireHouseholdId, requireUserId } from "@/lib/api/middleware";
import { draftFromPlainText } from "@/lib/plain-import";

export async function POST(request: NextRequest) {
  try {
    const context = await getRequestContext(request);
    const householdId = requireHouseholdId(context);
    const createdBy = context.userId || context.clientId;
    if (!createdBy) {
      requireUserId(context);
    }

    const body = (await request.json()) as { source?: string; content?: string };
    if (!body.content?.trim() || (body.source !== "url" && body.source !== "paste")) {
      throw new BadRequestError("Provide source (url or paste) and content");
    }

    let draft;
    if (body.source === "url") {
      const importer = createUrlImporter();
      const raw = await importer.extract({ url: body.content.trim() });
      draft = await importer.toDraft(raw);
    } else if (isAiGatewayConfigured(process.env)) {
      const importer = createPasteImporter();
      const raw = await importer.extract({ text: body.content });
      draft = await importer.toDraft(raw);
    } else {
      draft = draftFromPlainText(body.content);
    }

    const db = getDatabase();
    const service = new RecipeService(db);
    const recipe = await service.createRecipeFromDraft(draft, {
      householdId,
      createdBy: createdBy as string,
    });

    return createdResponse(recipe, `/api/v1/recipes/${recipe.id}`);
  } catch (error) {
    return handleApiError(error, request.url);
  }
}
